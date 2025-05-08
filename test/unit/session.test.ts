import verifySession from '../../src/services/session';
import { initPg } from '../services/db';

import type { Client } from 'pg';
import type { IncomingMessage } from 'node:http';

let clientPg: Client;

beforeAll(async () => {
  clientPg = await initPg();
});

describe('verifySession', () => {

  test('Throws on malformed cookie strings', async () => {
    const res = {};
    const req = {
      headers: {
        cookie: 'foo=bar foo'
      }
    };

    await expect(() => verifySession(req as any, clientPg)).rejects.toBeTruthy();
  });

  test('Returns undefined if session cannot be verified', async () => {
    const res = {};
    const req = {
      headers: {}
    };

    await expect(verifySession(req as IncomingMessage, clientPg)).resolves.toBe(undefined);
  });

  test('Returns username if session is successfully verified', async () => {
    const res = {};
    const req = {
      headers: {
        cookie: `_session="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJfdXNlcm5hbWUiOiJmb29iYXIiLCJpc3MiOiJsb2NhbGhvc3QiLCJhdWQiOiJjbGllbnQiLCJzdWIiOiJzZXNzaW9uIiwiaWF0IjoxNzQ2NjkzMTEyLCJleHAiOjE3NDY4NjU5MTJ9.lwrmtiFaJM0Z_93qQkJf-pNZ5aa1lD88ExG5KOCNF4o"`
      }
    }
  
    await expect(verifySession(req as IncomingMessage, clientPg)).resolves.toBe('foobar');
  });
});

afterAll(async () => {
  await clientPg.end();
});
