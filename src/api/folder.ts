import { handle302, handle400, handle405 } from '../services/error';
import verifySession from '../services/session';
import { random } from '../services/misc';

import type { IncomingMessage, ServerResponse } from 'http';
import type { Client } from 'pg';

async function handlePOST(req: IncomingMessage, res: ServerResponse, clientPG: Client, clientRD: any, userid: string) {
  {
    req.setEncoding('utf8')
    let data: string = '';
    for await (const chunk of req) data += chunk;
    try {
      var opts = JSON.parse(data);
      if (!opts.name) throw new Error();
    } catch(e: any) {
      return handle400(res, 'Request params could not be parsed');
    }
  }

  const exists = await clientPG.query(`SELECT folderid FROM folder WHERE name = '${opts.name}'`).then(r => r.rows.length > 0)
  if (exists)
    return handle400(res, 'Folder name already exists');

  let folderid = await random(8);
  while (await clientPG.query(`SELECT name FROM folder WHERE folderid = '${folderid}'`).then(r => r.rows.length > 0))
    folderid = (parseInt(userid, 16)+1).toString(16);
  await clientPG.query(`INSERT INTO folder(folderid, userid, name) VALUES ('${folderid}', '${userid}', '${opts.name}')`);
  
  // dump cache
  await clientRD.del(`${userid}:folderlist`);

  res.statusCode = 201;
  res.end();
}

async function handleDELETE(req: IncomingMessage, res: ServerResponse, clientPG: Client, clientRD: any, userid: string): Promise<void> {
  try {
    const params = new URL(req.url || '/', 'https://localhost').searchParams;
    var opts = {
      folder: params.get('name') || undefined,
    };
    if (!opts.folder) throw new Error();
  } catch(e: any) {
    return handle400(res, 'Request params could not be parsed');
  }

  // throw error if folder does not exist
  const folderid: string | undefined = await clientPG.query(`SELECT folderid FROM folder WHERE userid = '${userid}' AND name = '${opts.folder}'`)
    .then(r => r.rows[0] ? r.rows[0].folderid : undefined);
  if (!folderid)
    return handle400(res, 'Folder does not exist');

  let subs: { subid: string, feedid: string }[];
  subs = await clientPG.query(`SELECT sub.subid, sub.feedid FROM folder INNER JOIN subscription sub ON folder.folderid = sub.folderid \
\ \ WHERE folder.folderid = '${folderid}'`).then(r => r.rows);

  // will hold all the posts that have the starred entry in the status table,
  // but don't belong to any of the users subscriptions
  let batch: string[] = [];

  for (let i=0; i<subs.length; i++) {
    // remove the subscription
    await clientPG.query(`DELETE FROM subscription WHERE subid = '${subs[i].subid}'`);

    // update the feed table
    const count = await clientPG.query(`UPDATE feed SET count = count-1 WHERE feedid = '${subs[i].feedid}' RETURNING feed.count`).then(r => r.rows[0].count);
    if (!count)
      await clientPG.query(`DELETE FROM feed WHERE feedid = '${subs[i].feedid}'`);

    // check if user has any other subscriptions to the same feed...
    let more = await clientPG.query(`SELECT feedid FROM account INNER JOIN folder ON account.userid = folder.userid \
\ \ \ INNER JOIN subscription sub ON folder.folderid = sub.folderid WHERE sub.feedid = '${subs[i].feedid}'`)
      .then(r => r.rows.length !== 0);

    // ...if not, starred entries from the status table can be safely removed
    if (!more) {
      const query = `SELECT post.postid \
\ \ \ \ \ FROM feed INNER JOIN post ON feed.feedid = post.feedid INNER JOIN status ON post.postid = status.postid \ 
\ \ \ \ \ WHERE feed.feedid = '${subs[i].feedid}' AND status.star AND status.userid = '${userid}'`;
      await clientPG.query(query).then(r => batch.push(...r.rows.map(e => e.postid)));
    }
  }

  await clientPG.query(`DELETE FROM folder WHERE folderid = '${folderid}' AND userid = '${userid}'`);
  if (batch.length)
    await clientPG.query(`DELETE FROM status WHERE userid = '${userid}' AND postid IN (${batch.map(e => `'${e}'`).toString()})`);
 
  // dump cache
  await clientRD.del(`${userid}:${folderid}`);

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
    case 'POST': handlePOST(req, res, clientPG, clientRD, userid); break;
    case 'DELETE': handleDELETE(req, res, clientPG, clientRD, userid); break;
    default: handle405(res);
  }
}
