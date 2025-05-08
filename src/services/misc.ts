import * as crypto from 'node:crypto';

import type { Message, Cookies } from '../types.d';
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

export const encoder = new TextEncoder();
export const decoder = new TextDecoder();
export function normalize(input: string | Uint8Array): string {
  let encoded = input;
  if (encoded instanceof Uint8Array) {
    encoded = decoder.decode(encoded);
  }
  return encoded;
}
export const decodeBASE64 = (input: Uint8Array | string) => new Uint8Array(Buffer.from(normalize(input), 'base64'));
export const encodeBASE64 = (input: Uint8Array | string) => Buffer.from(input).toString('base64url');

export function parseCookieString(cstring: string): Cookies {
  if (!cstring) return {};
  const cookieName = /[!#$%&'*+-.^_`|~0-9A-z]+/;
  const cookieValue = /"?(\x21|[\x23-\x2B]|[\x2D-\x3A]|[\x3C-\x5B]|[\x5D-\x7E])*"?/;
  const cookiePair = new RegExp(`${cookieName.source}=${cookieValue.source}`);
  const cookieString = new RegExp(`^${cookiePair.source}(;\x20${cookiePair.source})?$`);
  if (!cstring.match(cookieString)) throw new Error('Invalid cookie string');

  let cookies: Cookies = {}; 
  for (let cookie of cstring.split(' ')) {
    cookie = cookie.replace(';', '');
    let { 0: name, 1: value } = cookie.split('=');
    value = value.replaceAll(/"/g, '');
    cookies[name] = value;
  }

  return cookies;
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

export function blockEL() {
  const start = Date.now();
  while (Date.now() - start < 3000);
}

export function blockUV(res: ServerResponse) {
  crypto.pbkdf2('foo', 'bar', 10000000, 64, 'sha256', () => {
    res.statusCode = 200;
    res.end();
  });
}
