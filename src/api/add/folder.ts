import { handle302, handle400, handle405 } from '../../services/error';
import verifySession from '../../services/session';
import { random } from '../../services/misc';

import type { IncomingMessage, ServerResponse } from 'http';
import type { Client } from 'pg';

async function handlePOST(req: IncomingMessage, res: ServerResponse, clientPg: Client, userid: string) {
  req.setEncoding('utf8')
  {
    let data: string = '';
    for await (const chunk of req) data += chunk;
    try {
      var serialized = JSON.parse(data);
      if (!serialized.name) throw new Error();
    } catch(e: any) {
      return handle400(res, 'Request could not be parsed');
    }
  }

  if (await clientPg.query(`select * from folder where name = '${serialized.name}'`).then(r => r.rows.length !== 0))
    return handle400(res, 'Folder name already exists');

  let folderid = await random(8);
  while (await clientPg.query(`select from folder where folderid = '${folderid}'`).then(r => r.rows.length !== 0))
    userid = (parseInt(userid, 16)+1).toString(16);
  await clientPg.query(`insert into folder(folderid, userid, name) values ('${folderid}', '${userid}', '${serialized.name}')`);

  res.statusCode = 201;
  res.end();
}

export async function handle(req: IncomingMessage, res: ServerResponse, clientPg: Client): Promise<void> {
  res.strictContentLength = true;
  try {
    var userid = await verifySession(req, clientPg);
    if (!userid)
      return handle302(res, `https://${process.env.HOST}:${process.env.PORT}/auth/local/login`, req.url || '/');
  } catch(e: any) {
    return handle400(res, e.message);
  }

  switch (req.method) {
    case 'GET': break;
    case 'POST': handlePOST(req, res, clientPg, userid); break;
    default: handle405(res);
  }
}
