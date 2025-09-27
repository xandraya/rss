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
    path: '/api/user/folders',
  }

  beforeAll(async () => {
    await CLIENT_PG.query(`INSERT INTO folder (folderid, userid, name) VALUES ('1', '${process.env._TEST_USERID}', 'folder01')`);
    await CLIENT_PG.query(`INSERT INTO folder (folderid, userid, name) VALUES ('2', '${process.env._TEST_USERID}', 'folder02')`);
  });

  afterEach(async () => {
    await CLIENT_RD.del(`${process.env._TEST_USERID}:folderlist`);
  });

  afterAll(async () => {
    await CLIENT_PG.query('TRUNCATE TABLE folder CASCADE');
  });

  test('Returns names of all folders that belong to the logged in user', async () => {
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
      await CLIENT_RD.sMembers(`${process.env._TEST_USERID}:folderlist`).then((r: string[]) => { 
        expect(r.length).toBe(2);
        expect(r[0]).toBe('folder01');
        expect(r[1]).toBe('folder02');
      });
    });
  });
});
