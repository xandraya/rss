import * as https from 'node:https';
import { initPG } from '../../../../src/services/db';

import type { Client } from 'pg';

let clientPG: Client;

describe('GET', () => {
  const options = {
    hostname: process.env._HOSTNAME,
    port: 8081,
    headers: {
      'Cookie': '_session="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJfdXNlcmlkIjoiYWRmOGMyZWUwNTBiMjE3MyIsImlzcyI6ImxvY2FsaG9zdCIsImF1ZCI6ImNsaWVudCIsInN1YiI6InNlc3Npb24iLCJpYXQiOjE3NDc2NDU3MjgsImV4cCI6MTgxMDcxNzcyOH0.yz2GqqSA1f9TbWIW54c7qPydqWS5AqZCsUmQOq2jjow"',
    },
    method: 'GET',
    protocol: 'https:',
    path: '/api/fetch/folder',
  }

  beforeAll(async () => {
    clientPG = await initPG('test');
    await clientPG.query(`INSERT INTO folder (folderid, userid, name) VALUES ('1', 'adf8c2ee050b2173', 'folder01')`);
    await clientPG.query(`INSERT INTO folder (folderid, userid, name) VALUES ('2', 'adf8c2ee050b2173', 'folder02')`);
  });

  afterAll(async () => {
    await clientPG.query('TRUNCATE TABLE folder CASCADE');
    await clientPG.end();
  });
  

  test('Returns names of all folders that belong to the logged in user', async () => {
    const request = new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
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
});
