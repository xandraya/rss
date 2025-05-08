import * as crypto from 'node:crypto';
import * as util from 'node:util';
import { encoder, decoder, decodeBASE64 } from './misc';

import type { IncomingMessage } from 'node:http';
import type { NodeErrorConstructor } from '../types.d';
import type * as pg from 'pg';

export default async function httpBasicAuth(req: IncomingMessage, clientPg: pg.Client): Promise<string | undefined> {
  let auth: string[] | undefined;

  if (!req.headersDistinct.authorization)
    throw new (Error as NodeErrorConstructor)('401', { cause: 'Basic realm="/", charset="UTF-8"' }); 
  auth = req.headersDistinct.authorization[0].split(' ');
  if (auth.length < 2 || auth[0] !== 'Basic')
    throw new (Error as NodeErrorConstructor)('401', { cause: 'Basic realm="/", charset="UTF-8"' }); 

  const scrypt = util.promisify(crypto.scrypt);

  const data = decoder.decode(decodeBASE64(auth[1]));
  const [username, password] = data.split(':');

  if (!username.match(/^[a-zA-Z0-9_]{4,32}$/))
    throw new (Error as NodeErrorConstructor)('400', { cause: 'Username invalid' }); 
  if (!password.match(/^.{8,32}$/))
    throw new (Error as NodeErrorConstructor)('400', { cause: 'Password invalid' }); 
  const saved = await clientPg.query(`select password, salt from account where "username" = '${username}'`).then(r => { 
    return r.rows[0] as { password: string, salt: string } | undefined; 
  });
  if (!saved)
    throw new (Error as NodeErrorConstructor)('403', { cause: 'Missing user' }); 

  const expected = saved.password;
  const actual = await scrypt(password, saved.salt, 32).then(r => (r as Buffer).toString('hex'));
  
  var status = crypto.timingSafeEqual(encoder.encode(expected), encoder.encode(actual));
  if (!status)
    throw new (Error as NodeErrorConstructor)('403', { cause: 'Invalid password' }); 

  return username;
}
