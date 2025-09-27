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
    default: handle405(res);
  }
}
