import { handle302, handle307, handle400, handle401, handle403, handle405 } from '../../services/error';
import httpBasicAuth from '../../services/basic';
import JWT from '../../services/jwt';
import { encoder, parseCookieString } from '../../services/misc';
import verifySession from '../../services/session';

import type { IncomingMessage, ServerResponse } from 'http';
import type { Client } from 'pg';

async function handleGET(req: IncomingMessage, res: ServerResponse, clientPg: Client) {
  try {
    var userid = await httpBasicAuth(req, clientPg);
  } catch (e: any) {
    switch (e.message) {
      case '400':
        return handle400(res, e.cause);
      case '401':
        return handle401(res, e.cause);
      case '403':
        return handle403(res, e.cause);
      default:
        return handle400(res, 'Unknown error');
    }
  }

  const expiry = new Date;
  expiry.setHours(expiry.getHours()+48);
  const token = new JWT({ _userid: userid })
    .setIssuer('localhost')
    .setAudience('client')
    .setSubject('session')
    .setIssuedAt()
    .setExpirationTime(expiry)
    .setSignature(encoder.encode(process.env._JWT_KEY));

  try {
    var cookies = parseCookieString(req.headers.cookie || '');
  } catch(e: any) {
    return handle400(res, 'Malformed cookie string');
  }

  res.appendHeader('Set-Cookie', `_session="${token.toString()}"; Domain=${process.env.HOST}; Path=/; Max-Age=3600; SameSite=Strict`)
  handle302(res, `https://${process.env.HOST}:${process.env.PORT}${cookies._referer || '/'}`, '');
  return;
}

export async function handle(req: IncomingMessage, res: ServerResponse, clientPg: Client): Promise<void> {
  res.strictContentLength = true;
  try {
    const userid = await verifySession(req, clientPg);
    if (userid)
      return handle307(res, `https://${process.env.HOST}:${process.env.PORT}/`, req.url || '/');
  } catch(e: any) {
    return handle400(res, e.message);
  }

  switch (req.method) {
    case 'GET': await handleGET(req, res, clientPg); break;
    default: handle405(res);
  }
}
