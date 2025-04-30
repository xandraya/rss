import { handle403, handle405 } from '../../services/error.ts';
import { parseURIParams, escape } from '../../services/misc.ts';
import httpBasicAuth from '../../services/basic.ts';

import type * as http from 'node:http';
import type * as pg from 'pg';
import type { AuthRequest } from '../../types.d';

// state implemenation missing
const authCode = 'foobar';

function isAuthRequest(obj: {}): obj is AuthRequest {
  if (typeof obj !== 'object') return false;

  const actualKeys = Object.keys(obj);
  const expectedKeys = ['response_type', 'cliend_id', 'redirect_uri', 'scope', 'state'];
  // check if params exist more than once
  if (!actualKeys.includes('response_type')) return false;
  if (!actualKeys.includes('client_id')) return false;
  for (let key of actualKeys) {
    if (!expectedKeys.includes(key)) return false;
  }

  return true;
}

function authorizeClient(client_id: string) {
  return true;
}

function validateScope(scope: string | undefined) {
  return true;
}

async function generateGrant(req: http.IncomingMessage, res: http.ServerResponse, client: pg.Client) {
  try {

  } catch {

  }
  const paramIndex = req.url!.indexOf('?');
  if (paramIndex === -1) {
    handle403(res, 'Request parameters missing');
    return;
  } 
  const params = parseURIParams(req.url!.slice(paramIndex+1));  

  if (!params.redirect_uri || !params.client_id) {
    handle403(res, 'Malformed redirect_uri or invalid cliend_id');
    return;
  } 
  // missing validation

  const errorMsg = !isAuthRequest(params) ? 'invalid_request' :
    !authorizeClient(params.client_id) ? 'unauthorized_client' :
    !validateScope(params.scope) ? 'invalid_scope' : '';

  if (errorMsg) {
    res.statusCode = 302;
    res.setHeader('Location',
`${params.redirect_uri}?error=${errorMsg}\
&error_description=generic\
&error_uri=${escape('https://example.com')}\
${params.state ? String.prototype.concat('&state=', params.state) : ''}`
    );
    res.end();
    return;
  }

  //auth user
  if (/* auth succeeded */ await httpBasicAuth(req, res, client)) {
    res.statusCode = 302;
    res.setHeader('Location', 
`${params.redirect_uri}?code=${authCode}\
${params.state ? String.prototype.concat('&state=', params.state) : ''}`
    );
    res.end();
    return;
  }
}

export async function handleAuth(req: http.IncomingMessage, res: http.ServerResponse, client: pg.Client): Promise<number> {
  res.strictContentLength = true;

  switch (req.method) {
    case 'GET': await generateGrant(req, res, client); break;
    default: handle405(res);
  }

  return 0;
}

export async function handleToken(req: http.IncomingMessage, res: http.ServerResponse, client: pg.Client): Promise<number> {
  res.strictContentLength = true;

  switch (req.method) {
    case 'GET': break;
    default: handle405(res);
  }

  return 0;
}
