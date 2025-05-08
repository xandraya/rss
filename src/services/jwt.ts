import * as crypto from 'node:crypto';
import { encoder, decoder, decodeBASE64, encodeBASE64 } from './misc';

import type { JWTHeader, JWTPayload, JWTInput, Algorithm } from '../types.d';
import type * as pg from 'pg';

function concatBuffers(...buffers: Uint8Array[]): Uint8Array {
  const size = buffers.reduce((acc, { length }) => acc + length, 0);
  const temp = new Uint8Array(size);
  let i = 0;
  for (const buffer of buffers) {
    temp.set(buffer, i);
    i += buffer.length;
  }
  return temp;
}

class JWTError extends Error {
  auth_err: string;
  auth_desc: string;
  constructor(err: string, message: string) {
    super(message);
    this.auth_err = err;
    this.auth_desc = message;
  }
}

export default class JWT {
  private _header: JWTHeader;
  private _payload: JWTPayload;
  private _signature!: Uint8Array;

  constructor(payload: JWTPayload = {}) {
    this._payload = payload
    this._header = {
      typ: 'JWT',
      alg: 'HS256',
    }
  }

  private digest = (alg: Algorithm): string => {
    switch (alg) {
      case 'HS256': return 'sha256'
      case 'HS384': return 'sha384'
      case 'HS512': return 'sha512'
    }
  };

  // jose header
  setHeader(header: JWTHeader) {
    this._header = header
    return this
  }

  // jws payload
  setIssuer(issuer: string) {
    this._payload = { ...this._payload, iss: issuer }
    return this
  }
  setSubject(subject: string) {
    this._payload = { ...this._payload, sub: subject }
    return this
  }
  setAudience(audience: string | string[]) {
    this._payload = { ...this._payload, aud: audience }
    return this
  }
  setExpirationTime(input: Date) {
    this._payload = { ...this._payload, exp: Math.floor(input.getTime() / 1000) }
    return this
  }
  setNotBefore(input: Date) {
    this._payload = { ...this._payload, nbf: Math.floor(input.getTime() / 1000) }
    return this
  }
  setIssuedAt() {
    this._payload = { ...this._payload, iat: Math.floor((new Date).getTime() / 1000) }
    return this
  }
  setJti(jwtId: string) {
    this._payload = { ...this._payload, jti: jwtId }
    return this
  }

  // jws signature
  setSignature(secret: Uint8Array) {
    
    let header = encoder.encode(encodeBASE64(JSON.stringify(this._header)));
    let payload = encoder.encode(encodeBASE64(JSON.stringify(this._payload)));
    const data = concatBuffers(header, encoder.encode('.'), payload);

    const hmac = crypto.createHmac(this.digest(this._header.alg), crypto.createSecretKey(secret));
    hmac.update(data);
    this._signature = hmac.digest();
    return this;
  }

  toString(): string {
    return `${encodeBASE64(JSON.stringify(this._header))}.${encodeBASE64(JSON.stringify(this._payload))}.${encodeBASE64(this._signature)}`;
  }

  get header(): JWTHeader {
    return this._header;
  }

  get payload(): JWTPayload {
    return this._payload;
  }

  async verify(jwtString: string, secret: Uint8Array, client: pg.Client) {
    {
      const { 0: header, 1: payload, 2: signature, length } = jwtString.split('.');
      if (length !== 3) throw new JWTError('invalid_token', 'Invalid JWT Token');
      var jwt: JWTInput = { header, payload, signature };
    }

    if (!jwt.header.length) throw new JWTError('invalid_token', 'JWT Header missing')
    if (!jwt.payload.length) throw new JWTError('invalid_token', 'JWT Payload missing');
    if (!jwt.signature.length) throw new JWTError('invalid_token', 'JWT Signature missing');

    try {
      var parsedHeader: JWTHeader = JSON.parse(decoder.decode(decodeBASE64(jwt.header)));
      var parsedPayload: JWTPayload = JSON.parse(decoder.decode(decodeBASE64(jwt.payload)));
      var parsedSignature: Uint8Array = decodeBASE64(jwt.signature);
    } catch {
      throw new JWTError('invalid_token', 'JWT parsing failed');
    }

    if (!parsedHeader.typ || parsedHeader.typ !== 'JWT')
      throw new JWTError('invalid_token', 'Invalid JWT type parameter');
    if (!parsedHeader.alg || !(new Set(['HS256', 'HS384', 'HS512']).has(parsedHeader.alg))) 
      throw new JWTError('invalid_token', 'Algorithm unsupported');

    const data = concatBuffers(
      encoder.encode(jwt.header),
      encoder.encode('.'),
      encoder.encode(jwt.payload)
    );

    const hmac = crypto.createHmac(this.digest(parsedHeader.alg), crypto.createSecretKey(secret));
    hmac.update(data);
    const actual = hmac.digest();
    const expected = parsedSignature;

    try {
      crypto.timingSafeEqual(actual, expected);
    } catch {
      throw new JWTError('insufficient_scope', 'JWT Token verification failed');
    }

    if (this._payload.iss && parsedPayload.iss && parsedPayload.iss !== this._payload.iss)
      throw new JWTError('invalid_token', 'Issuer mismatch');

    if (this._payload.aud && parsedPayload.aud && parsedPayload.aud !== this._payload.aud)
      throw new JWTError('invalid_token', 'Audience mismatch');

    if (this._payload.sub && parsedPayload.iss && parsedPayload.sub !== this._payload.sub)
      throw new JWTError('insufficient_scope', 'Subject mismatch');

    if (parsedPayload.exp) {
      if (typeof parsedPayload.exp !== 'number')
        throw new JWTError('invalid_token', '"Expiration Time" field must be an Unix timestamp');
      
      if (this._payload.iat && this._payload.iat > parsedPayload.exp)
        throw new JWTError('invalid_token', 'Token expired');
    }

    if (parsedPayload.nbf && this._payload.iat) {
      if (typeof parsedPayload.nbf !== 'number') {
        throw new JWTError('invalid_token', '"Not Before" field must be an Unix timestamp')
      }
      if (parsedPayload.nbf > this._payload.iat) {
        throw new JWTError('invalid_token', 'Can\'t verify before the "Not Before" timestamp')
      }
    }
    
    // verify private claims
    const expClaims = Object.entries(this._payload).filter((claim: [string, unknown]) => claim[0].startsWith('_')).sort();
    const actClaims = Object.entries(parsedPayload).filter((claim: [string, unknown]) => claim[0].startsWith('_')).sort();

    if (expClaims.length) {
      if (expClaims.length !== actClaims.length) throw new JWTError('invalid_token', 'Claims length mismatch');

      for (let i=0; i<expClaims.length; i++) {
        if (expClaims[i][1] !== actClaims[i][1]) throw new JWTError('insufficient_scope', 'Private claims verification failed');

        if (expClaims[i][0] === '_username')
          await client.query(`select * from account where "username" = '${actClaims[i][1]}'`).then(r => {
            if (!r.rows.length) throw new JWTError('insufficient_scope', 'User not found');
          });
      }
    }

    // no error thrown === all claims valid
    return true;
  }
}
