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
      'Cookie': '_session="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJfdXNlcmlkIjoiYWRmOGMyZWUwNTBiMjE3MyIsImlzcyI6ImxvY2FsaG9zdCIsImF1ZCI6ImNsaWVudCIsInN1YiI6InNlc3Npb24iLCJpYXQiOjE3NDc2NDU3MjgsImV4cCI6MTgxMDcxNzcyOH0.yz2GqqSA1f9TbWIW54c7qPydqWS5AqZCsUmQOq2jjow"',
    },
    method: 'GET',
    protocol: 'https:',
    path: '/api/user/folders',
  }

  beforeAll(async () => {
    await CLIENT_PG.query(`INSERT INTO folder (folderid, userid, name) VALUES ('1', 'adf8c2ee050b2173', 'folder01')`);
    await CLIENT_PG.query(`INSERT INTO folder (folderid, userid, name) VALUES ('2', 'adf8c2ee050b2173', 'folder02')`);
  });

  afterAll(async () => {
    await CLIENT_PG.query('TRUNCATE TABLE folder CASCADE');
  });
  

  test('Returns 200 and names of all folders that belong to the logged in user', async () => {
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

    return expect(request).resolves.toEqual(['folder01', 'folder02']);
  });

  test('Returns 200 and caches the query', async () => {
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

    return request.then(async (res) => {
      await CLIENT_RD.hMembers('adf8c2ee050b2173:folderlist').then((r: string[]) => { 
        expect(r.length).toBe(2);
        expect(r[0]).toBe('folder01');
        expect(r[1]).toBe('folder02');
      });
      expect(res).toBe(200);
    });
  });
});
