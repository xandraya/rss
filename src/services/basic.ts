import * as crypto from 'node:crypto';
import * as util from 'node:util';
import { encoder, decoder, decodeBASE64 } from './misc';

import type { IncomingMessage } from 'node:http';
import type { NodeErrorConstructor } from '../types.d';
import type * as pg from 'pg';

// https://stackoverflow.com/questions/201323/how-can-i-validate-an-email-address-using-a-regular-expression#answer-201378
const emailRegex = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;

export default async function httpBasicAuth(req: IncomingMessage, clientPg: pg.Client): Promise<string | undefined> {
  let auth: string[] | undefined;

  if (!req.headersDistinct.authorization)
    throw new (Error as NodeErrorConstructor)('401', { cause: 'Basic realm="/", charset="UTF-8"' }); 
  auth = req.headersDistinct.authorization[0].split(' ');
  if (auth.length < 2 || auth[0] !== 'Basic')
    throw new (Error as NodeErrorConstructor)('401', { cause: 'Basic realm="/", charset="UTF-8"' }); 

  const scrypt = util.promisify(crypto.scrypt);

  const data = decoder.decode(decodeBASE64(auth[1]));
  const [email, password] = data.split(':');

  if (!email.match(emailRegex))
    throw new (Error as NodeErrorConstructor)('400', { cause: 'E-mail invalid' }); 
  if (!password.match(/^.{8,32}$/))
    throw new (Error as NodeErrorConstructor)('400', { cause: 'Password invalid' }); 
  const saved = await clientPg.query(`select userid, password, salt from account where "email" = '${email}'`).then(r => { 
    return r.rows[0] as { userid: string, password: string, salt: string } | undefined; 
  });
  if (!saved)
    throw new (Error as NodeErrorConstructor)('403', { cause: 'Missing user' }); 

  const expected = saved.password;
  const actual = await scrypt(password, saved.salt, 32).then(r => (r as Buffer).toString('hex'));
  
  var status = crypto.timingSafeEqual(encoder.encode(expected), encoder.encode(actual));
  if (!status)
    throw new (Error as NodeErrorConstructor)('403', { cause: 'Invalid password' }); 

  return saved.userid;
}
