import { hash } from 'node:crypto';
import HTTPClient from 'http_client';
import { handle302, handle307, handle400, handle403, handle405, handle500, handle503 } from '../../../services/error';
import verifySession from '../../../services/session';
import JWT from '../../../services/jwt';
import { encoder } from '../../../services/misc';

import type { IncomingMessage, ServerResponse } from 'http';
import type { Client } from 'pg';
import type HTTPClientRequestOptions from 'http_client';

async function handleGET(req: IncomingMessage, res: ServerResponse, client: HTTPClient, clientPG: Client, clientRD: any) {
  // parse params
  const params = new URL(req.url || '/', 'https://localhost').searchParams;

  const error = params.get('error');
  const code = params.get('code');
  const state = params.get('state');

  if (error) {
    if (error === 'server_error')
      return handle500(res, 'OAuth 2.0 Google authorization server error');
    if (error === 'temporary_unavailable')
      return handle503(res, 'OAuth 2.0 Google authorization server unavailable');
    return handle500(res, `OAuth 2.0 unhandled error: ${params.get('error')!}`);
  }
  if (!code || !state)
    return handle400(res, 'OAuth 2.0 Google authorization server returned malformed data');

  // verify state
  if (!await clientRD.sIsMember('oauth', state)) {
    console.log('Possible CSRF attack');
    console.log('code: ', code);
    console.log('state: ', state);
    return handle403(res, 'State mismatch. Possible CSRF attack');
  }
  await clientRD.sRem('oauth', state);

  // exchange code for access and refresh tokens
  let data = '';
  try {
    let postData = new URLSearchParams(Object.entries({
      grant_type: 'authorization_code',
      code: params.get('code')!,
      redirect_uri: 'https://localhost:6565/auth/oauth2/google/callback',
      client_id: process.env._OAUTH_CLIENT_ID!,
      client_secret: process.env._OAUTH_CLIENT_SECRET!,
    })).toString();

    const opts: HTTPClientRequestOptions = {
      host: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    }

    const cb = (chunk: Buffer) => data += chunk;
    await client.request(opts, cb, postData);
  } catch(e: any) {
    // 'data' variable should hold the response from Google's authorization server
    try {
      let parsed = JSON.parse(data);
      if (!parsed.error)
        throw {};

      if (parsed.error === 'invalid_grant')
        return handle302(res, '/auth/oauth2/google/login');
    } catch {
      return handle400(res, 'OAuth 2.0 Google authorization server unexpected error');
    }

    return handle500(res, `OAuth 2.0 client received error: ${data}`);
  }
    
  // parse the return data
  try {
    let parsed = JSON.parse(data);
    if (!parsed.access_token || !parsed.token_type) throw null;
    parsed.scope = parsed.scope || '';
    const scopes = ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'];
    for (let s of scopes)
      if (!parsed.scope.includes(s))
        return handle400(res, 'OAuth 2.0 Google authorization server returned invalid scopes');

    var access_token = parsed.access_token;
  } catch(e) {
    return handle400(res, 'OAuth 2.0 Google authorization server returned malformed data');
  }

  // call google api and get user credentials
  data = '';
  try {
    const opts: HTTPClientRequestOptions = {
      host: 'www.googleapis.com',
      path: '/userinfo/v2/me',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    }

    const cb = (chunk: Buffer) => data += chunk;
    await client.request(opts, cb);
  } catch(e: any) {
    // 'e' should be of type HTTPError
    if (e.code !== 400)
      return handle400(res, 'OAuth 2.0 Google resource server unexpected error');

    return handle500(res, `OAuth 2.0 client received error: ${JSON.parse(data).error}`);
  }

  // parse the return data
  try {
    let parsed = JSON.parse(data);
    if (!parsed.id || !parsed.name|| !parsed.email) throw null;

    var userid = 'oauth' + hash('sha256', parsed.id).slice(0, 27);
    var username = parsed.name;
    var email = parsed.email;
  } catch(e) {
    return handle400(res, 'OAuth 2.0 Google resource server returned malformed data');
  }

  // set the session string
  const expiry = new Date;
  expiry.setMonth(expiry.getMonth()+24);
  const token = new JWT({ _userid: userid })
    .setIssuer('localhost')
    .setAudience('client')
    .setSubject('session')
    .setIssuedAt()
    .setExpirationTime(expiry)
    .setSignature(encoder.encode(process.env._JWT_KEY));


  // insert into db
  await clientPG.query(`INSERT INTO account (userid, username, email) VALUES ('${userid}', '${username}', '${email}') ON CONFLICT DO NOTHING`);
  
  // redirect to root
  res.appendHeader('Set-Cookie', `_session="${token.toString()}"; Path=/; Max-Age=3600; SameSite=Strict, Secure; HttpOnly`)
  handle302(res, '/');
  return;
}

export async function handle(req: IncomingMessage, res: ServerResponse, client: HTTPClient, clientPG: Client, clientRD: any): Promise<void> {
  res.strictContentLength = true;
  try {
    const userid = await verifySession(req, clientPG);
    if (userid)
      return handle307(res, `/`);
  } catch(e: any) {
    return handle400(res, e.message);
  }

  switch (req.method) {
    case 'GET': await handleGET(req, res, client, clientPG, clientRD); break;
    default: handle405(res);
  }
}
