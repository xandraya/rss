import { handle405 } from '../../services/error.ts';
import { escape } from '../../services/misc.ts'

import type * as http from 'node:http';
import type * as pg from 'pg';

function begin(req: http.IncomingMessage, res: http.ServerResponse, client: pg.Client) {
  if (!process.env._OAUTH_CLIENT_ID) throw new Error('oauth/client/start: Missing oauth client ID');

  // due to missing frontend implementation, immediately begin oauth chain by redirecting to the authorization endpoint
  res.statusCode = 302;
  res.setHeader('Location',
`/oauth/auth/authenticate?response_type=code\
&client_id=${process.env._OAUTH_CLIENT_ID}\
&state=xyz\
&redirect_uri=${escape('/oauth/client/redirect')}\
&scope=abc`
  );
  res.end();
}

export async function handleStart(req: http.IncomingMessage, res: http.ServerResponse, client: pg.Client): Promise<number> {
  res.strictContentLength = true;

  switch (req.method) {
    case 'GET': begin(req, res, client); break;
    default: handle405(res);
  }

  return 0;
}

export async function handleRedirect(req: http.IncomingMessage, res: http.ServerResponse, client: pg.Client): Promise<number> {
  res.strictContentLength = true;

  switch (req.method) {
    case 'GET': break;
    default: handle405(res);
  }

  return 0;
}
