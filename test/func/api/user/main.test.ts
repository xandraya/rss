import * as https from 'node:https';
import { initPG, initRD } from '../../../../src/services/db';

import type { Client } from 'pg';

let CLIENT_PG: Client;
let CLIENT_RD: any;

beforeAll(async () => {
  CLIENT_PG = await initPG('test');
  CLIENT_RD = await initRD(1);
});

afterAll(async () => {
  await CLIENT_PG.end();
  await CLIENT_RD.quit();
});

describe('GET', () => {
  const options = {
    hostname: 'app',
    port: 8081,
    headers: {
      'Cookie': `_session="${process.env._TEST_SESSION}"`,
    },
    method: 'GET',
    protocol: 'https:',
    path: '/api/user',
  }

  test('Returns user metadata', async () => {
    const request = new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        expect(res.statusCode).toBe(200);

        let data = '';
        res.on('data', (d: string) => {
          data += d;
        });
        res.on('end', () => {
          resolve(JSON.parse(data));
        });
      });

      req.on('error', (e) => {
        reject(e);
      });
      req.end();
    })

    return expect(request).resolves.toEqual({ userid: 'adf8c2ee050b2173', username: 'foobar', email: 'foobar@example.com' });
  });

  test('Caches the query', async () => {
    const request = new Promise<void>((resolve, reject) => {
      const req = https.request(options, (res) => {
        expect(res.statusCode).toBe(200);

        let data = '';
        res.on('data', (d: string) => {
          data += d;
        });
        res.on('end', () => {
          resolve();
        });
      });

      req.on('error', (e) => {
        reject(e);
      });
      req.end();
    })

    return request.then(async () => {
      await CLIENT_RD.get('adf8c2ee050b2173').then((r: any) => { 
        const info = JSON.parse(r);
        expect(info.userid).toBe('adf8c2ee050b2173');
        expect(info.username).toBe('foobar');
        expect(info.email).toBe('foobar@example.com');
      });
    });
  });
});
