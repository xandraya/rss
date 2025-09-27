import { handle302, handle400, handle405 } from '../../services/error';
import verifySession from '../../services/session';

import type { IncomingMessage, ServerResponse } from 'http';
import type { Client } from 'pg';

async function handleGET(res: ServerResponse, clientPG: Client, clientRD: any, userid: string): Promise<void> {
  let key = `${userid}`;

  // first attempt fetching from cache
  if (Number(process.env._CACHING)) {
    const cachedData: string | null = await clientRD.get(key);
    if (cachedData) {
      console.log('/user CACHE HIT');

      res.statusCode = 200;
      res.end(JSON.stringify(cachedData));
      return;
    }
  }
  console.log('/user CACHE MISS');

  const info: string[] = await clientPG.query(`SELECT userid, username, email FROM account WHERE userid = '${userid}'`).then(r => r.rows[0]);

  if (Number(process.env._CACHING))
    await clientRD.set(key, JSON.stringify(info));

  res.statusCode = 200;
  res.end(JSON.stringify(info));
}

async function handleDELETE(res: ServerResponse, clientPG: Client, clientRD: any, userid: string): Promise<void> {
  let subs: { subid: string, feedid: string }[];
  subs = await clientPG.query(`SELECT sub.subid, sub.feedid FROM folder INNER JOIN subscription sub ON folder.folderid = sub.folderid \
\ \ WHERE folder.userid = '${userid}'`).then(r => r.rows);

  for (let i=0; i<subs.length; i++) {
    // remove the subscription
    await clientPG.query(`DELETE FROM subscription WHERE subid = '${subs[i].subid}'`);

    // update the feed table
    const count = await clientPG.query(`UPDATE feed SET count = count-1 WHERE feedid = '${subs[i].feedid}' RETURNING feed.count`).then(r => r.rows[0].count);
    if (!count)
      await clientPG.query(`DELETE FROM feed WHERE feedid = '${subs[i].feedid}'`);
  }

  const folders: string[] = await clientPG.query(`SELECT folderid FROM folder WHERE userid = '${userid}'`).then(r => r.rows.map(e => e.folderid));

  // dump cache for each folder
  for (let id of folders)
    await clientRD.del(`${userid}:${id}`);

  // finalize deletion
  await clientPG.query(`DELETE FROM folder WHERE userid = '${userid}'`);
  await clientPG.query(`DELETE FROM account WHERE userid = '${userid}'`);

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
    case 'GET': handleGET(res, clientPG, clientRD, userid); break;
    case 'DELETE': handleDELETE(res, clientPG, clientRD, userid); break;
    default: handle405(res);
  }
}
