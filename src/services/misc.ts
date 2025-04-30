import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import JWT from './jwt.ts';

import type { Message } from '../types.d';
import type { IncomingMessage, ServerResponse } from 'node:http';

export function sendMessage(wrkID: number, short: string, req?: IncomingMessage) {
  if (process.send) {
    const msg: Message = {
      short: short,
      long: {
        id: wrkID,
      }
    }

    if (req) {
      msg.short = `Incoming connection ${req.socket.remoteAddress}:${req.socket.remotePort} at Worker ${wrkID}`; 
      msg.long.address = req.socket.remoteAddress;
      msg.long.port = req.socket.remotePort;
      msg.long.family = req.socket.remoteFamily;
      msg.long.url = req.url;
      msg.long.method = req.method;
      msg.long.headers = req.headers;
    }

    process.send(msg);
  }

  else console.log("node.js process didn't spawn with an IPC channel, cannot send messages");
}

export function printProtoChain<Type extends { __proto__: Object }>(obj: Type | null): void {
  if (!obj) return;

  let chain = '';
  obj = obj.__proto__ as Type | null;
  while (obj) {
    chain += obj.constructor.name;
    chain += ', ';
    obj = obj.__proto__ as Type | null;
  }
  chain += 'null;';
  console.log(chain);
}

export function escape(str: string) {
	return Array.from(str).map(e => {
		switch(e) {
			case '<': return '%3C';
			case '>': return '%3E';
			case '#': return '%23';
			case '%': return '%25';
			case '+': return '%2B';
			case '{': return '%7B';
			case '}': return '%7D';
			case '|': return '%7C';
			case '\\': return '%5C';
			case '^': return '%5E';
			case '~': return '%7E';
			case '[': return '%5B';
			case ']': return '%5D';
			case ';': return '%3B';
			case '/': return '%2F';
			case '?': return '%3F';
			case ':': return '%3A';
			case '@': return '%40';
			case '=': return '%3D';
			case '&': return '%26';
			case '$': return '%24';
			default: return e;
		}
	}).join('').replace(/\s+/g, '%20');
}

export function initJWT() {
  const encoder = new TextEncoder();

  const expiry = new Date;
  expiry.setHours(expiry.getHours()+3);
  const token = new JWT({ _user: 'user1234' })
    .setIssuer('me:)')
    .setAudience('me:)')
    .setSubject('private')
    .setIssuedAt()
    .setExpirationTime(expiry)
    .setSignature(encoder.encode(process.env._JWT_KEY));

  fs.writeFileSync('./token.txt', token.toString());
}

export function blockEL(res: ServerResponse) {
  const start = Date.now();
  while (Date.now() - start < 3000);
}

export function blockUV(res: ServerResponse) {
  crypto.pbkdf2('foo', 'bar', 10000000, 64, 'sha256', () => {
    res.statusCode = 200;
    res.end();
  });
}

export function parseURIParams(str: string) {
  if (!str || !str.includes('&')) throw new Error('misc: Invalid query parameter list');
  const obj: { [key: string]: string } = {};
  const params = str.split('&');
  for (let param of params) {
    let [key, value] = param.split('=');
    if (!key || !value) throw new Error('misc: Invalid query parameter list');
    obj[key] = value;
  }
  return obj;
}
