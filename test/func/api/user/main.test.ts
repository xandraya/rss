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

  afterEach(async () => {
    await CLIENT_RD.del(process.env._TEST_USERID);
  });

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

    return await request.then(r => expect(r).toEqual({ userid: process.env._TEST_USERID, username: 'foobar', email: 'foobar@example.com' }));
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
      await CLIENT_RD.get(process.env._TEST_USERID).then((r: any) => { 
        const info = JSON.parse(r);
        expect(info.userid).toBe(process.env._TEST_USERID);
        expect(info.username).toBe('foobar');
        expect(info.email).toBe('foobar@example.com');
      });
    });
  });
});

describe('DELETE', () => {
  const options = {
    hostname: 'app',
    port: 8081,
    headers: {
      'Cookie': `_session="${process.env._TEST_SESSION}"`,
    },
    method: 'DELETE',
    protocol: 'https:',
    path: '/api/user',
  }

  beforeEach(async () => {
    await CLIENT_PG.query('TRUNCATE TABLE account, folder, feed, subscription, post, status CASCADE');

    await CLIENT_PG.query(`insert into account (userid, username, email, password, salt) \
\ \ \ values ('${process.env._TEST_USERID}', 'foobar', 'foobar@example.com', \
\ \ \ '146ac20e1a62c07bc57d7ce563a9d27f0e67d81d50463b0edda7ca00c6e75d3d', 'f9f087de76da49429146dedf3fb59342')`);
    await CLIENT_PG.query(`INSERT INTO folder (folderid, userid, name) VALUES ('1', '${process.env._TEST_USERID}', 'folder01')`);

    await CLIENT_PG.query(`INSERT INTO account (userid, username, email, password, salt) VALUES ('2', 'account02', 'account02@example.com', 'password', 'salt')`);
    await CLIENT_PG.query(`INSERT INTO folder (folderid, userid, name) VALUES ('2', '2', 'folder02')`);
  });

  afterAll(async () => {
    await CLIENT_PG.query('TRUNCATE TABLE account, folder, feed, subscription, post, status CASCADE');

    await CLIENT_PG.query(`insert into account (userid, username, email, password, salt) \
\ \ \ values ('${process.env._TEST_USERID}', 'foobar', 'foobar@example.com', \
\ \ \ '146ac20e1a62c07bc57d7ce563a9d27f0e67d81d50463b0edda7ca00c6e75d3d', 'f9f087de76da49429146dedf3fb59342')`);
  });

  test('Removes feeds without bound subscriptions', async () => {
    await CLIENT_PG.query(`INSERT INTO feed (feedid, url, count) VALUES ('1', 'https://localhost/null', 1)`);
    await CLIENT_PG.query(`INSERT INTO feed (feedid, url, count) VALUES ('2', 'https://localhost/null', 99)`);
    await CLIENT_PG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('1', '1', '1', 'sub01', 'Mon, 01 Jan 1970 00:00:00 GMT')`);
    await CLIENT_PG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('2', '1', '2', 'sub02', 'Mon, 01 Jan 1970 00:00:00 GMT')`);

    const request = new Promise<void>((resolve, reject) => {
      options.path = '/api/user';

      const req = https.request(options, (res) => {
        expect(res.statusCode).toBe(204);

        res.on('data', () => {});
        res.on('end', () => {
          resolve();
        });
      });

      req.on('error', (e) => {
        reject(e);
      });
      req.end();
    });

    return request.then(async () => {
      await CLIENT_PG.query('SELECT feedid FROM feed').then(r => {
        expect(r.rows.length).toBe(1);
        expect(r.rows[0].feedid).toBe('2');
      });
    });
  });

  test('Removes account, folder, subscription and status entries', async () => {
    await CLIENT_PG.query(`INSERT INTO feed (feedid, url, count) VALUES ('1', 'https://localhost/null', 2)`);
    await CLIENT_PG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('1', '1', '1', 'sub01', 'Mon, 01 Jan 1970 00:00:00 GMT')`);
    await CLIENT_PG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('2', '2', '1', 'sub02', 'Mon, 01 Jan 1970 00:00:00 GMT')`);
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) values ('1', '1', 'post01', 'Mon, 01 May 1970 00:00:00 GMT', 'http://localhost/null')`);
    await CLIENT_PG.query(`INSERT INTO status (userid, postid, star) VALUES ('${process.env._TEST_USERID}', '1', true)`);
    await CLIENT_PG.query(`INSERT INTO status (userid, postid, star) VALUES ('2', '1', true)`);

    const request = new Promise<void>((resolve, reject) => {
      options.path = '/api/user';

      const req = https.request(options, (res) => {
        expect(res.statusCode).toBe(204);

        res.on('data', () => {});
        res.on('end', () => {
          resolve();
        });
      });

      req.on('error', (e) => {
        reject(e);
      });
      req.end();
    });

    return request.then(async () => {
      await CLIENT_PG.query('SELECT userid FROM account').then(r => {
        expect(r.rows.length).toBe(1);
        expect(r.rows[0].userid).toBe('2');
      });
      await CLIENT_PG.query('SELECT folderid FROM folder').then(r => {
        expect(r.rows.length).toBe(1);
        expect(r.rows[0].folderid).toBe('2');
      });
      await CLIENT_PG.query('SELECT subid FROM subscription').then(r => {
        expect(r.rows.length).toBe(1);
        expect(r.rows[0].subid).toBe('2');
      });
      await CLIENT_PG.query('SELECT userid FROM status').then(r => {
        expect(r.rows.length).toBe(1);
        expect(r.rows[0].userid).toBe('2');
      });
    });
  });

  test('Dumps the cache', async () => {
    await CLIENT_RD.hSet(`${process.env._TEST_USERID}:1`, 'foo', 'bar');

    const request = new Promise<void>((resolve, reject) => {
      options.path = '/api/user';

      const req = https.request(options, (res) => {
        expect(res.statusCode).toBe(204);

        res.on('data', () => {});
        res.on('end', () => {
          resolve();
        });
      });

      req.on('error', (e) => {
        reject(e);
      });
      req.end();
    });

    return request.then(async () => {
      expect(CLIENT_RD.hLen(`${process.env._TEST_USERID}:1`)).resolves.toBe(0);
    });
  });
});
