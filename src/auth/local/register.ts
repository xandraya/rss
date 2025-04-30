import * as crypto from 'node:crypto';
import { promisify } from 'node:util';
import { URL } from 'node:url';
import { handle400, handle405 } from '../../services/error.ts';

import type { IncomingMessage, ServerResponse } from 'http';
import type { Client } from 'pg';

// https://stackoverflow.com/questions/201323/how-can-i-validate-an-email-address-using-a-regular-expression#answer-201378
const emailRegex = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;

async function handlePOST(req: IncomingMessage, res: ServerResponse, client: Client) {
  const random = async (num: number) => await promisify(crypto.randomBytes)(num).then(r => (r as Buffer).toString('hex'));
  const scrypt = promisify(crypto.scrypt);
  const url = new URL(`https://${process.env.HOST ?? 'localhost'}${req.url}`); 

  const username = url.searchParams.get('username');
  const password = url.searchParams.get('password');
  const email = url.searchParams.get('email');
  if (!username || !password || !email) return handle400(res);

  if (!username.match(/^[a-zA-Z0-9_]{4,32}$/)) return handle400(res);
  if (!password.match(/^.{8,32}$/)) return handle400(res);
  if (!email.match(emailRegex)) return handle400(res);
  // ^ not validating does the email actually exist

  const userid = await random(32);
  const salt = await random(32);
  const hash = await scrypt(password.normalize('NFC'), salt, 32).then(r => (r as Buffer).toString('hex'));
  client.query(`insert into account (userid, username, password, salt) values ('${userid}', '${username}, '${hash}', '${salt}')`);

  res.statusCode = 201;
  res.end();
}

export async function handle(req: IncomingMessage, res: ServerResponse, clientPg: Client): Promise<number> {
  res.strictContentLength = true;

  switch (req.method) {
    case 'POST': await handlePOST(req, res, clientPg); break;
    default: handle405(res);
  }

  return 0;
}
