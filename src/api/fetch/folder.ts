import { handle302, handle400, handle405 } from '../../services/error';
import verifySession from '../../services/session';

import type { IncomingMessage, ServerResponse } from 'http';
import type { Client } from 'pg';

async function handleGET(res: ServerResponse, clientPG: Client, userid: string): Promise<void> {
  const folders: string[] = await clientPG.query(`SELECT name FROM folder WHERE userid = '${userid}'`).then(r => r.rows.map(entry => entry.name));

  res.statusCode = 200;
  res.end(JSON.stringify(folders));
}

export async function handle(req: IncomingMessage, res: ServerResponse, clientPG: Client): Promise<void> {
  res.strictContentLength = true;

  try {
    var userid = await verifySession(req, clientPG);
    if (!userid)
      return handle302(res, `/auth/local/login`, req.url || '/');
  } catch(e: any) {
    return handle400(res, e.message);
  }

  switch (req.method) {
    case 'GET': handleGET(res, clientPG, userid); break;
    default: handle405(res);
  }
}
