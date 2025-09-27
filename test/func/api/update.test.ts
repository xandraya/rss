import * as https from 'node:https';
import { initPG, initRD } from '../../../src/services/db';

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

describe('POST', () => {
  const options = {
    hostname: 'app',
    port: 8081,
    headers: {
      'Cookie': `_session="${process.env._TEST_SESSION}"`,
    },
    method: 'POST',
    protocol: 'https:',
    path: '/api/update',
  }

  beforeAll(async () => {
    await CLIENT_PG.query(`INSERT INTO folder (folderid, userid, name) VALUES ('1', 'adf8c2ee050b2173', 'folder01')`);
    await CLIENT_PG.query(`INSERT INTO folder (folderid, userid, name) VALUES ('2', 'adf8c2ee050b2173', 'folder02')`);
  });

  afterEach(async () => {
    await CLIENT_PG.query('TRUNCATE TABLE feed, subscription, post, status');
  });

  afterAll(async () => {
    await CLIENT_PG.query('TRUNCATE TABLE folder CASCADE');
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
        { folder: 'null' }
      ));
      req.end();
    });

    return expect(request).resolves.toMatch(new RegExp('Folder does not exist'));
  });

  test('Skips adding posts that are already in the database', async () => {
    await CLIENT_PG.query(`INSERT INTO feed (feedid, url, count) VALUES ('1', 'https://app:8082/api/blob/func_refresh_01.xml', 1)`);
    await CLIENT_PG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('1', '1', '1', 'sub01', 'Mon, 01 Jan 1970 00:00:00 GMT')`);
    await CLIENT_PG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('2', '2', '1', 'sub02', 'Mon, 01 Jan 1972 00:00:00 GMT')`);
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) values ('04f3362fc426a395', '1', '01', 'Mon, 01 Jun 1971 00:00:01 GMT', 'http://localhost/01.html')`);

    const request = new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        expect(res.statusCode).toBe(201)

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
        { folder: 'folder01' }
      ));
      req.end();
    });

    return request.then(async () => {
      await CLIENT_PG.query(`SELECT postid FROM post WHERE feedid = '1' ORDER BY date DESC`).then(r => {
        expect(r.rows.length).toBe(2);
        expect(r.rows[0].postid).toBe('04f3362fc426a395');
        expect(r.rows[1].postid).toBe('580d8a7078c23a0a');
      });
    });
  });

  test('Properly updates subscription\'s refresh_date', async () => {
    await CLIENT_PG.query(`INSERT INTO feed (feedid, url, count) VALUES ('1', 'https://app:8082/api/blob/null.xml', 1)`);
    await CLIENT_PG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('1', '1', '1', 'sub01', 'Mon, 01 Jan 1970 00:01:00 GMT')`);

    const request = new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        expect(res.statusCode).toBe(201);

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
        { folder: 'folder01' }
      ));
      req.end();
    });

    return request.then(async () => {
      await CLIENT_PG.query(`SELECT refresh_date FROM subscription WHERE subid = '1'`).then(r => {
        expect(r.rows.length).toBe(1);
        expect(new Date(r.rows[0].refresh_date).getTime()).toBeGreaterThan(new Date('Mon, 01 Jan 2025 00:00:00 GMT').getTime());
      });
    });
  });

  test('Removes non-starred posts that are AGE_POST_LIMIT older than the oldest subscriptions refresh_date for that feed', async () => {
    await CLIENT_PG.query(`INSERT INTO feed (feedid, url, count) VALUES ('1', 'https://app:8082/api/blob/func_refresh_02.xml', 1)`);
    await CLIENT_PG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('1', '1', '1', 'sub01', 'Mon, 01 Jan 1970 00:00:00 GMT')`);
    await CLIENT_PG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('2', '2', '1', 'sub02', 'Mon, 01 Jan 1972 00:00:00 GMT')`);
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) values ('3ad7be40ca9b988e', '1', 'star', 'Mon, 01 Jan 1970 00:00:00 GMT', 'http://localhost/star.html')`);
    await CLIENT_PG.query(`INSERT INTO status (userid, postid, star) VALUES ('adf8c2ee050b2173', '3ad7be40ca9b988e', true)`);

    const request = new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        expect(res.statusCode).toBe(201);

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
        { folder: 'folder01' }
      ));
      req.end();
    });

    return request.then(async () => {
      await CLIENT_PG.query(`SELECT postid FROM post WHERE feedid = '1' ORDER BY date DESC`).then(r => {
        expect(r.rows.length).toBe(2);
        expect(r.rows[0].postid).toBe('04f3362fc426a395');
        expect(r.rows[1].postid).toBe('3ad7be40ca9b988e');
      });
    });
  });

  test('Removes non-starred posts that go above the SUB_POST_LIMIT of the subscription with the oldest refresh_date for that feed', async () => {
    await CLIENT_PG.query(`INSERT INTO feed (feedid, url, count) VALUES ('1', 'https://app:8082/api/blob/func_refresh_03.xml', 1)`);
    await CLIENT_PG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('1', '1', '1', 'sub01', 'Mon, 01 Jan 1970 00:00:00 GMT')`);
    await CLIENT_PG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('2', '2', '1', 'sub02', 'Mon, 01 Jan 1972 00:00:00 GMT')`);
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) values ('3ad7be40ca9b988e', '1', 'star', 'Mon, 01 Jan 1970 00:00:00 GMT', 'http://localhost/star.html')`);
    await CLIENT_PG.query(`INSERT INTO status (userid, postid, star) VALUES ('adf8c2ee050b2173', '3ad7be40ca9b988e', true)`);

    const request = new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        expect(res.statusCode).toBe(201);

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
        { folder: 'folder01' }
      ));
      req.end();
    });

    return request.then(async () => {
      await CLIENT_PG.query(`SELECT postid FROM post WHERE feedid = '1' ORDER BY date DESC`).then(r => {
        expect(r.rows.length).toBe(4);
        expect(r.rows[0].postid).toBe('04f3362fc426a395');
        expect(r.rows[1].postid).toBe('580d8a7078c23a0a');
        expect(r.rows[2].postid).toBe('8b88c521887fc212');
        expect(r.rows[3].postid).toBe('3ad7be40ca9b988e');
      });
    });
  });

  test('Cache is dumped', async () => {
    await CLIENT_RD.hSet('adf8c2ee050b2173:1', 'foo', 'bar');

    const request = new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        expect(res.statusCode).toBe(201);

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
        { folder: 'folder01' }
      ));
      req.end();
    });

    return request.then(async () => {
      expect(CLIENT_RD.hLen('adf8c2ee050b2173:1')).resolves.toBe(0);
    });
  });
});
