import * as pg from 'pg';
import JWT from './jwt';
import { encoder, decoder, decodeBASE64, parseCookieString } from './misc';

import type { IncomingMessage } from "http";
import type { JWTInput, JWTPayload } from '../types.d';

export default async function verifySession(req: IncomingMessage, clientPg: pg.Client): Promise<string | undefined> {
  var cookies = parseCookieString(req.headers.cookie || '');

  if (cookies._session) {
    {
      const { 0: header, 1: payload, 2: signature, length } = cookies._session.split('.');
      if (length !== 3) throw new Error('Malformed JWT token');
      var jwt: JWTInput = { header, payload, signature };
    }

    if (!jwt.payload.length) throw new Error('Malformed JWT token');

    try {
      var parsedPayload: JWTPayload = JSON.parse(decoder.decode(decodeBASE64(jwt.payload)));
    } catch {
      throw new Error('Malformed JWT token');
    }

    try {
      await new JWT({ _userid: parsedPayload._userid })
        .setIssuer('localhost')
        .setAudience('client')
        .setSubject('session')
        .setIssuedAt()
        .setSignature(encoder.encode(process.env._JWT_KEY))
        .verify(cookies._session, encoder.encode(process.env._JWT_KEY), clientPg);
      return parsedPayload._userid as string;
    } catch(err: any) {
      console.log('Signature verification failed for user: ', parsedPayload._userid);
    }
  }

  // all verification opts failed, session not set
  return;
}
