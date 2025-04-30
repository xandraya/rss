import * as crypto from 'node:crypto';
import * as util from 'node:util';
import { handle401, handle403 } from './error.ts';

import type * as http from 'node:http';
import type * as pg from 'pg';

const encoder = new TextEncoder();

// Conforms to RFC 7617
export default async function httpBasicAuth(req: http.IncomingMessage, res: http.ServerResponse, client: pg.Client): Promise<boolean> {
  let auth: string[] | undefined;

  if (!req.headersDistinct.authorization) { handle401(res, 'Basic realm="private", charset="UTF-8"'); return false}
  auth = req.headersDistinct.authorization[0].split(' ');
  if (auth.length < 2 || auth[0] !== 'Basic') { handle401(res, 'Basic realm="private", charset="UTF-8"'); return false}

  {
    const scrypt = util.promisify(crypto.scrypt);

    const data = atob(auth[1]);
    const [user, pass] = data.split(':');
    const saved = await client.query(`select pass, salt from account where "user" = '${user}'`).then(r => { 
      return r.rows[0] as { pass:string, salt: string }; 
    });
    if (!saved) { handle403(res, 'Missing user'); return false}

    const expected = saved.pass;
    const actual = await scrypt(pass, saved.salt, 32).then(r => (r as Buffer).toString('hex'));
    
    var status = crypto.timingSafeEqual(encoder.encode(expected), encoder.encode(actual));
    if (!status) handle403(res, 'Invalid password');
  }

  return true;
}
