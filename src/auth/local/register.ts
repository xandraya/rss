import * as crypto from 'node:crypto';
import { promisify } from 'node:util';
import { URL } from 'node:url';
import { handle400, handle405 } from '../../services/error';
import { random } from '../../services/misc';

import type { IncomingMessage, ServerResponse } from 'http';
import type { Client } from 'pg';

// https://stackoverflow.com/questions/201323/how-can-i-validate-an-email-address-using-a-regular-expression#answer-201378
const emailRegex = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;

const template = `
<h1>Register</h1>
<form action='/auth/local/register' enctype='application/x-www-form-urlencoded' method='POST'>
  <div>
    <label for='username'>User</label>
    <input type='text' id='username' name='username' required />
  </div>
  <div>
    <label for='password'>Pass</label>
    <input type='password' id='password' name='password' require />
  </div>
  <div>
    <label for='email'>E-mail</label>
    <input type='email' id='email' name='email' required />
  </div>
  <button type='submit'>Register</button>
</form>
`

async function handleGET(res: ServerResponse) {
  res.statusCode = 200;
  res.end(template);
}

async function handlePOST(req: IncomingMessage, res: ServerResponse, client: Client) {
  const scrypt = promisify(crypto.scrypt);
  if (req.headersDistinct.encoding && req.headersDistinct.encoding[0] !== 'application/x-www-form-urlencoded') { handle400(res, 'Invalid content type'); return; }

  req.setEncoding('utf8')
  let data: string = '';
  for await (const chunk of req) data += chunk;
  const url = new URL(`https://localhost/status?${data}`); 

  const username = url.searchParams.get('username');
  const password = url.searchParams.get('password');
  const email = url.searchParams.get('email');
  if (!username || !password || !email) return handle400(res, "Missing credentials");

  if (!username.match(/^[a-zA-Z0-9_]{4,32}$/)) return handle400(res, "Username invalid");
  if (!password.match(/^.{8,32}$/)) return handle400(res, "Password invalid");
  if (!email.match(emailRegex)) return handle400(res, "E-mail invalid");
  if (await client.query(`select from account where email = '${email}'`).then(r => r.rows.length !== 0))
    return handle400(res, "Account with this e-mail already exists");

  let userid = await random(8);
  while (await client.query(`select from account where userid = '${userid}'`).then(r => r.rows.length !== 0))
    userid = (parseInt(userid, 16)+1).toString(16);

  const salt = await random(16);
  const hash = await scrypt(password.normalize('NFC'), salt, 32).then(r => (r as Buffer).toString('hex'));
  await client.query(`insert into account (userid, username, email, password, salt) values ('${userid}', '${username}', '${email}', '${hash}', '${salt}')`);

  res.statusCode = 201;
  res.end('Successfully registered!');
}

export async function handle(req: IncomingMessage, res: ServerResponse, clientPg: Client): Promise<void> {
  res.strictContentLength = true;

  switch (req.method) {
    case 'GET': await handleGET(res); break;
    case 'POST': await handlePOST(req, res, clientPg); break;
    default: handle405(res);
  }
}
