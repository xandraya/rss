import verifySession from '../../src/services/session';
import { initPG } from '../services/db';

import type { Client } from 'pg';
import type { IncomingMessage } from 'node:http';

let CLIENT_PG: Client;

beforeAll(async () => {
  CLIENT_PG = await initPG('test');
});

afterAll(async () => {
  await CLIENT_PG.end();
});

describe('verifySession', () => {
  test('Throws on malformed cookie strings', async () => {
    const req = {
      headers: {
        cookie: 'foo=bar foo'
      }
    };
    await expect(() => verifySession(req as IncomingMessage, CLIENT_PG)).rejects.toBeTruthy();
  });

  test('Returns undefined if session cannot be verified', async () => {
    const req = {
      headers: {}
    };
    await expect(verifySession(req as IncomingMessage, CLIENT_PG)).resolves.toBe(undefined);
  });

  test('Returns username if session is successfully verified', async () => {
    const req = {
      headers: {
        cookie: `_session="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJfdXNlcmlkIjoiYWRmOGMyZWUwNTBiMjE3MyIsImlzcyI6ImxvY2FsaG9zdCIsImF1ZCI6ImNsaWVudCIsInN1YiI6InNlc3Npb24iLCJpYXQiOjE3NDc2NDU3MjgsImV4cCI6MTgxMDcxNzcyOH0.yz2GqqSA1f9TbWIW54c7qPydqWS5AqZCsUmQOq2jjow"`
      }
    }
    await expect(verifySession(req as IncomingMessage, CLIENT_PG)).resolves.toBe('adf8c2ee050b2173');
  });
});
