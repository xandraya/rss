import { handle405, handle501 } from '../../services/error.ts';

import type { IncomingMessage, ServerResponse } from 'http';
import type { Client } from 'pg';

const template = `
<h1>Login</h1>
<form action='/login' method='POST'>
  <div>
    <label for='user'>User</label>
    <input type='text' id='user' name='user' required />
  </div>
  <div>
    <label for='pass'>Pass</label>
    <input type='password' id='pass' name='pass' required />
  </div>
  <button type='submit'>Login</button>
</form>
`

async function handleGET(req: IncomingMessage, res: ServerResponse, clientPg: Client, clientRedis: any) {
  res.statusCode = 200;
  res.end(template);
}

async function handlePOST(req: IncomingMessage, res: ServerResponse, clientPg: Client, clientRedis: any) {
  handle501(res);
}

export async function handle(req: IncomingMessage, res: ServerResponse, clientPg: Client, clientRedis: any): Promise<number> {
  res.strictContentLength = true;

  switch (req.method) {
    case 'GET': await handleGET(req, res, clientPg, clientRedis); break;
    case 'POST': await handlePOST(req, res, clientPg, clientRedis); break;
    default: handle405(res);
  }

  return 0;
}
