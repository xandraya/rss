import { handle302, handle400, handle405 } from '../services/error';
import verifySession from '../services/session';
import { random } from '../services/misc';

import type { IncomingMessage, ServerResponse } from 'http';
import type { Client } from 'pg';

async function handlePOST(req: IncomingMessage, res: ServerResponse, userid: string, clientPG: Client) {
  req.setEncoding('utf8')
  {
    let data: string = '';
    for await (const chunk of req) data += chunk;
    try {
      var serialized = JSON.parse(data);
      if (!serialized.name) throw new Error();
    } catch(e: any) {
      return handle400(res, 'Request params could not be parsed');
    }
  }

  const exists = await clientPG.query(`SELECT folderid FROM folder WHERE name = '${serialized.name}'`).then(r => r.rows.length > 0)
  if (exists) return handle400(res, 'Folder name already exists');

  let folderid = await random(8);
  while (await clientPG.query(`SELECT name FROM folder WHERE folderid = '${folderid}'`).then(r => r.rows.length > 0))
    folderid = (parseInt(userid, 16)+1).toString(16);
  await clientPG.query(`INSERT INTO folder(folderid, userid, name) VALUES ('${folderid}', '${userid}', '${serialized.name}')`);

  res.statusCode = 201;
  res.end();
}

async function handleDELETE(req: IncomingMessage, res: ServerResponse): Promise<void> {
  req.setEncoding('utf8')
  {
    let data: string = '';
    for await (const chunk of req) data += chunk;
    try {
      var serialized = JSON.parse(data);
      if (!serialized.name) throw new Error();
    } catch(e: any) {
      return handle400(res, 'Request params could not be parsed');
    }
  }

  /* for each of the supplied subscriptions id's modify entries in the feed table by
    * decrementing the counter value
    * removing the entry if counter value reaches 0
  */

  // handle edge case of users having stared posts that don't belong to any of their subscriptions
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
    case 'GET': break;
    case 'POST': handlePOST(req, res, userid, clientPG); break;
    default: handle405(res);
  }
}
