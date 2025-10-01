import { handle302, handle307, handle400, handle405 } from '../../../services/error';
import verifySession from '../../../services/session';
import { random } from '../../../services/misc';

import type { IncomingMessage, ServerResponse } from 'http';
import type { Client } from 'pg';

async function handleGET(res: ServerResponse, clientRD: any) {
  // generate a state hash used to prevent CSRF and cache it
  const state = await random(32);
  await clientRD.sAdd('oauth', state);

  // generate a grant request url
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth/oauthchooseaccount');
  const scopes = ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'];
  const params = {
    client_id: process.env._OAUTH_CLIENT_ID,
    redirect_uri: 'https://localhost:6565/auth/oauth2/google/callback',
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'online',
    prompt: 'select_account',
    state: state,
  }
  for (let [key, val] of Object.entries(params))
    url.searchParams.set(key, val);

  // redirect user to the authorization server
  handle302(res, url.toString());
  return;
}

export async function handle(req: IncomingMessage, res: ServerResponse, clientPg: Client, clientRD: any): Promise<void> {
  res.strictContentLength = true;
  try {
    const userid = await verifySession(req, clientPg);
    if (userid)
      return handle307(res, `/`);
  } catch(e: any) {
    return handle400(res, e.message);
  }

  switch (req.method) {
    case 'GET': await handleGET(res, clientRD); break;
    default: handle405(res);
  }
}
