import * as https from 'node:https';
import { initPG } from '../../../src/services/db';

import type { Client } from 'pg';

let CLIENT_PG: Client;

describe('POST', () => {
  const options = {
    hostname: 'app',
    port: 8081,
    headers: {
      'Cookie': '_session="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJfdXNlcmlkIjoiYWRmOGMyZWUwNTBiMjE3MyIsImlzcyI6ImxvY2FsaG9zdCIsImF1ZCI6ImNsaWVudCIsInN1YiI6InNlc3Npb24iLCJpYXQiOjE3NDc2NDU3MjgsImV4cCI6MTgxMDcxNzcyOH0.yz2GqqSA1f9TbWIW54c7qPydqWS5AqZCsUmQOq2jjow"',
    },
    method: 'POST',
    protocol: 'https:',
    path: '/api/sub',
  }

  beforeAll(async () => {
    CLIENT_PG = await initPG('test');
    await CLIENT_PG.query(`INSERT INTO folder (folderid, userid, name) VALUES ('1', 'adf8c2ee050b2173', 'folder01')`);
    await CLIENT_PG.query(`INSERT INTO folder (folderid, userid, name) VALUES ('2', 'adf8c2ee050b2173', 'folder02')`);
  });

  afterAll(async () => {
    await CLIENT_PG.query('TRUNCATE TABLE folder, feed, subscription, post, status CASCADE');
    await CLIENT_PG.end();
  });

  afterEach(async () => {
    await CLIENT_PG.query('TRUNCATE TABLE feed, subscription CASCADE');
  });

  test('Returns 400 if parameters are missing', () => {
    const request = new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        expect(res.statusCode).toBe(400);

        let data = '';
        res.on('data', (d: string) => {
          data += d;
        });
        res.on('end', () => {
          resolve(data);
        });
      });

      req.on('error', (e) => {
        reject(e);
      });
      req.write(JSON.stringify(
        { foo: "bar" }
      ));
      req.end();
    })

    return expect(request).resolves.toMatch(new RegExp('Request params could not be parsed'));
  });

  test('Returns 400 if subscription with the same name already exists', async () => {
    await CLIENT_PG.query(`INSERT INTO feed (feedid, url, count) VALUES ('1', 'https://localhost/rss.xml', 1)`);
    await CLIENT_PG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('1', '1', '1', 'sub01', 'Mon, 01 Jun 1971 00:00:00 GMT')`);

    const request = new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        expect(res.statusCode).toBe(400);

        let data = '';
        res.on('data', (d: string) => {
          data += d;
        });
        res.on('end', () => {
          resolve(data);
        });
      });

      req.on('error', (e) => {
        reject(e);
      });
      req.write(JSON.stringify(
        { name: 'sub01', folder: 'folder01', url: 'https://localhost/null' }
      ));
      req.end();
    });

    return expect(request).resolves.toMatch(new RegExp('Subscription with this name already exists'));
  });

  test('Returns 400 if subscription to the same feed already exists', async () => {
    await CLIENT_PG.query(`INSERT INTO feed (feedid, url, count) VALUES ('1', 'https://localhost/rss.xml', 1)`);
    await CLIENT_PG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('1', '1', '1', 'sub01', 'Mon, 01 Jun 1971 00:00:00 GMT')`);

    const request = new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        expect(res.statusCode).toBe(400);

        let data = '';
        res.on('data', (d: string) => {
          data += d;
        });
        res.on('end', () => {
          resolve(data);
        });
      });

      req.on('error', (e) => {
        reject(e);
      });
      req.write(JSON.stringify(
        { name: 'null', folder: 'folder01', url: 'https://localhost/rss.xml' }
      ));
      req.end();
    });

    return expect(request).resolves.toMatch(new RegExp('Subscription to this feed already exists'));
  });

  test('Returns 400 if folder does not exist', () => {
    const request = new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        expect(res.statusCode).toBe(400);
        
        let data = '';
        res.on('data', (d: string) => {
          data += d;
        });
        res.on('end', () => {
          resolve(data);
        });
      });

      req.on('error', (e) => {
        reject(e);
      });
      req.write(JSON.stringify(
        { name: 'null', folder: 'null', url: 'https://localhost/null' }
      ));
      req.end();
    });

    return expect(request).resolves.toMatch(new RegExp('Folder does not exist'));
  });

  test('Returns 201 if subscription to an already known feed is successfully added', async () => {
    await CLIENT_PG.query(`INSERT INTO feed (feedid, url, count) VALUES ('1', 'https://localhost/rss.xml', 1)`);
    await CLIENT_PG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('1', '1', '1', 'sub01', 'Mon, 01 Jun 1971 00:00:00 GMT')`);

    const request = new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        res.on('data', () => {});
        res.on('end', () => {
          resolve(res.statusCode);
        });
      });

      req.on('error', (e) => {
        reject(e);
      });
      req.write(JSON.stringify(
        { name: 'null', folder: 'folder02', url: 'https://localhost/rss.xml' }
      ));
      req.end();
    });

    return expect(request).resolves.toBe(201);
  });

  test('Returns 201 if subscription to an unknown feed is successfully added', () => {
    const request = new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        res.on('data', () => {});
        res.on('end', () => {
          resolve(res.statusCode);
        });
      });

      req.on('error', (e) => {
        reject(e);
      });
      req.write(JSON.stringify(
        { name: 'null', folder: 'folder02', url: 'https://localhost/atom.xml' }
      ));
      req.end();
    });

    return expect(request).resolves.toBe(201);
  });
});
