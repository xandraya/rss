import { handle302, handle400, handle405 } from '../services/error';
import verifySession from '../services/session';
import { random } from '../services/misc';

import type { IncomingMessage, ServerResponse } from 'http';
import type { Client } from 'pg';

async function handlePOST(req: IncomingMessage, res: ServerResponse, clientPG: Client, userid: string): Promise<void> {
  {
    req.setEncoding('utf8')
    let data: string = '';
    for await (const chunk of req) data += chunk;
    try {
      var opts = JSON.parse(data);
      if (!opts.name) throw new Error();
      if (!opts.folder) throw new Error();
      if (!opts.url) throw new Error();
    } catch(e: any) {
      return handle400(res, 'Request params could not be parsed');
    }
  }

  // throw error if subscription already exists
  let exists: boolean;
  exists = await clientPG.query(`SELECT name from subscription WHERE name = '${opts.name}'`)
    .then(r => r.rows.length > 0);
  if (exists) return handle400(res, 'Subscription with this name already exists');
  exists = await clientPG.query(`SELECT folder.name, feed.url FROM folder INNER JOIN subscription sub ON folder.folderid = sub.folderid \
\ \ INNER JOIN feed ON sub.feedid = feed.feedid WHERE folder.name = '${opts.folder}' AND feed.url = '${opts.url}'`)
    .then(r => r.rows.length > 0);
  if (exists) return handle400(res, 'Subscription to this feed already exists');
  
  // throw error if folder does not exist
  const folderid: string | undefined = await clientPG.query(`SELECT folderid FROM folder WHERE userid = '${userid}' AND name = '${opts.folder}'`)
    .then(r => r.rows[0] ? r.rows[0].folderid : undefined);
  if (!folderid) return handle400(res, 'Folder does not exist');

  // add/modify entry in the feed table
  const url = new URL(opts.url);
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
\ \ VALUES ('${subid}', '${folderid}', '${feedid}', '${opts.name}', '${(new Date(0)).toUTCString()}')`);

  res.statusCode = 201;
  res.end();
}

async function handleDELETE(req: IncomingMessage, res: ServerResponse, clientPG: Client, clientRD: any, userid: string): Promise<void> {
  try {
    const params = new URL(req.url || '/', 'https://localhost').searchParams;
    var opts = {
      folder: params.get('folder') || undefined,
      sub: params.get('name') || undefined,
    };
    if (!opts.folder || !opts.sub) throw new Error();
  } catch(e: any) {
    return handle400(res, 'Request params could not be parsed');
  }

  // throw error if folder does not exist
  const folderid: string | undefined = await clientPG.query(`SELECT folderid FROM folder WHERE userid = '${userid}' AND name = '${opts.folder}'`)
    .then(r => r.rows[0] ? r.rows[0].folderid : undefined);
  if (!folderid)
    return handle400(res, 'Folder does not exist');

  const [subid, feedid, date] = await clientPG.query(`SELECT sub.subid, sub.feedid, sub.refresh_date FROM folder INNER JOIN subscription sub ON folder.folderid = sub.folderid \
\ \ WHERE folder.folderid = '${folderid}' AND sub.name = '${opts.sub}'`).then(r => Object.values(r.rows[0] ?? []));

  // throw error if subscription does not exist
  if (!subid)
    return handle400(res, 'Subscription does not exist');

  // remove the subscription
  await clientPG.query(`DELETE FROM subscription WHERE subid = '${subid}'`);
  
  // no need to do anything else if subscription never got refreshed
  if (+ new Date(date as string)) {
    // will hold all the posts that have the starred entry in the status table,
    // but don't belong to any of the users subscriptions
    let batch: string[] = [];

    // update the feed table
    let feedExists = true;
    await clientPG.query(`UPDATE feed SET count = count-1 WHERE feedid = '${feedid}'`);
    if (await clientPG.query(`SELECT count FROM feed WHERE feedid = '${feedid}'`).then(r => Number(r.rows[0].count) === 0)) {
      await clientPG.query(`DELETE FROM feed WHERE feedid = '${feedid}'`);
      feedExists = false;
    }

    if (feedExists) {
      // check if user has any other subscriptions to the same feed...
      let more = await clientPG.query(`SELECT feedid FROM account INNER JOIN folder ON account.userid = folder.userid \
    \ \ INNER JOIN subscription sub ON folder.folderid = sub.folderid WHERE sub.feedid = '${feedid}'`)
        .then(r => r.rows.length !== 0);

      // ...if not, starred entries from the status table can be safely removed
      if (!more) {
        const query = `SELECT post.postid \
    \ \ \ \ FROM feed INNER JOIN post ON feed.feedid = post.feedid INNER JOIN status ON post.postid = status.postid \ 
    \ \ \ \ WHERE feed.feedid = '${feedid}' AND status.star AND status.userid = '${userid}'`;
        await clientPG.query(query).then(r => batch.push(...r.rows.map(e => e.postid)));
      }

      if (batch.length)
        await clientPG.query(`DELETE FROM status WHERE userid = '${userid}' AND postid IN (${batch.map(e => `'${e}'`).toString()})`);
    }
   
    // dump cache
    await clientRD.del(`${userid}:${folderid}`);
  }

  res.statusCode = 204;
  res.end();
}

export async function handle(req: IncomingMessage, res: ServerResponse, clientPG: Client, clientRD: any): Promise<void> {
  res.strictContentLength = true;

  try {
    var userid = await verifySession(req, clientPG);
    if (!userid)
      return handle302(res, `/auth/local/login`, req.url || '/');
  } catch(e: any) {
    return handle400(res, e.message);
  }

  switch (req.method) {
    case 'POST': handlePOST(req, res, clientPG, userid); break;
    case 'DELETE': handleDELETE(req, res, clientPG, clientRD, userid); break;
    default: handle405(res);
  }
}
