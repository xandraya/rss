import { handle302, handle400, handle405 } from '../../services/error';
import verifySession from '../../services/session';
import { random } from '../../services/misc';

import type { IncomingMessage, ServerResponse } from 'http';
import type { Client } from 'pg';

async function handlePOST(req: IncomingMessage, res: ServerResponse, userid: string, clientPG: Client): Promise<void> {
  req.setEncoding('utf8')
  {
    let data: string = '';
    for await (const chunk of req) data += chunk;
    try {
      var serialized = JSON.parse(data);
      if (!serialized.name) throw new Error();
      if (!serialized.folder) throw new Error();
      if (!serialized.url) throw new Error();
    } catch(e: any) {
      return handle400(res, 'Request params could not be parsed');
    }
  }

  // throw error if subscription already exists
  let exists: boolean;
  exists = await clientPG.query(`SELECT name from subscription WHERE name = '${serialized.name}'`)
    .then(r => r.rows.length > 0);
  if (exists) return handle400(res, 'Subscription with this name already exists');
  exists = await clientPG.query(`SELECT folder.name, feed.url FROM folder INNER JOIN subscription sub ON folder.folderid = sub.folderid \
\ \ INNER JOIN feed ON sub.feedid = feed.feedid WHERE folder.name = '${serialized.folder}' AND feed.url = '${serialized.url}'`)
    .then(r => r.rows.length > 0);
  if (exists) return handle400(res, 'Subscription to this feed already exists');
  
  // throw error if folder does not exist
  const folderid: string | undefined = await clientPG.query(`SELECT folderid FROM folder WHERE userid = '${userid}' AND name = '${serialized.folder}'`)
    .then(r => r.rows[0] ? r.rows[0].folderid : undefined);
  if (!folderid) return handle400(res, 'Folder does not exist');

  // add/modify entry in the feed table
  const url = new URL(serialized.url);
  let feedid = await clientPG.query(`SELECT feedid FROM feed WHERE url = '${url.origin}${url.pathname}'`).then(r => r.rows[0] ? r.rows[0].feedid : undefined);
  if (feedid)
    await clientPG.query(`UPDATE feed SET count = count+1 WHERE url = '${url.origin}${url.pathname}'`);
  else {
    feedid = await random(8);
    while (await clientPG.query(`SELECT url FROM feed WHERE feedid = '${feedid}'`).then(r => r.rows.length > 0))
      feedid = (parseInt(feedid, 16)+1).toString(16);
    await clientPG.query(`INSERT INTO feed (feedid, url, count) VALUES ('${feedid}', '${url.origin}${url.pathname}', 1)`);
  }

  // add new entry to the sub table
  let subid = await random(8);
  while (await clientPG.query(`SELECT name FROM subscription WHERE subid = '${subid}'`).then(r => r.rows.length > 0))
    subid = (parseInt(subid, 16)+1).toString(16);

  await clientPG.query(`INSERT INTO subscription(subid, folderid, feedid, name, refresh_date) \
\ \ VALUES ('${subid}', '${folderid}', '${feedid}', '${serialized.name}', '${(new Date(0)).toUTCString()}')`);

  res.statusCode = 201;
  res.end();
}

export async function handle(req: IncomingMessage, res: ServerResponse, clientPG: Client): Promise<void> {
  res.strictContentLength = true;

  try {
    var userid = await verifySession(req, clientPG);
    if (!userid)
      return  handle302(res, `/auth/local/login`, req.url || '/');
  } catch(e: any) {
    return handle400(res, e.message);
  }

  switch (req.method) {
    case 'POST': handlePOST(req, res, userid, clientPG); break;
    default: handle405(res);
  }
}
