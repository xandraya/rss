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
        cookie: `_session="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJfdXNlcmlkIjoiN2Y2NWY2YTRmNGIxYzVmNyIsImlzcyI6ImxvY2FsaG9zdCIsImF1ZCI6ImNsaWVudCIsInN1YiI6InNlc3Npb24iLCJpYXQiOjE3NDcxMjA5ODYsImV4cCI6MTc0NzI5Mzc4Nn0.fH3wJdEo_HJ7W1gmggi4v-hCblPJLKM71cno-joZ-to"`
      }
    }
  
    await expect(verifySession(req as IncomingMessage, clientPg)).resolves.toBe('7f65f6a4f4b1c5f7');
  });
});

afterAll(async () => {
  await clientPg.end();
});
