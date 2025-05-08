import { handle302, handle400, handle405 } from '../services/error';
import verifySession from '../services/session';

import type { IncomingMessage, ServerResponse } from 'http';
import type { Client } from 'pg';

const secret = `
<html>
  <head>
    <style>
      body {
        background-color: black;
        color: white;
      }
    </style>
  </head>
  <body>
    <h1>Secret</h1>
  </body>
</html>
`

export async function handleGET(req: IncomingMessage, res: ServerResponse, clientPg: Client, clientRedis: any) {
  res.statusCode = 200;
  res.end(secret);
  return;
}

export async function handle(req: IncomingMessage, res: ServerResponse, clientPg: Client, clientRedis: any): Promise<void> {
  res.strictContentLength = true;
  try {
    const username = await verifySession(req, clientPg);
    if (!username)
      return handle302(res, `https://${process.env.HOST}:${process.env.PORT}/auth/local/login`, req.url || '/');
  } catch(e: any) {
    handle400(res, e.toString());
  }

  switch (req.method) {
    case 'GET': handleGET(req, res, clientPg, clientRedis); break;
    default: handle405(res);
  }
}
