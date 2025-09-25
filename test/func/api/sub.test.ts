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
    path: '/api/sub',
  }

  beforeEach(async () => {
    await CLIENT_PG.query(`INSERT INTO folder (folderid, userid, name) VALUES ('1', 'adf8c2ee050b2173', 'folder01')`);
    await CLIENT_PG.query(`INSERT INTO folder (folderid, userid, name) VALUES ('2', 'adf8c2ee050b2173', 'folder02')`);
  });

  afterEach(async () => {
    await CLIENT_PG.query('TRUNCATE TABLE folder, feed, subscription, post, status CASCADE');
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

  test('Subscription to an already known feed is successfully added', async () => {
    await CLIENT_PG.query(`INSERT INTO feed (feedid, url, count) VALUES ('1', 'https://localhost/rss.xml', 1)`);
    await CLIENT_PG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('1', '1', '1', 'sub01', 'Mon, 01 Jun 1971 00:00:00 GMT')`);

    const request = new Promise<void>((resolve, reject) => {
      const req = https.request(options, (res) => {
        expect(res.statusCode).toBe(201);
        
        res.on('data', () => {});
        res.on('end', () => {
          resolve();
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

    return expect(request).resolves.toBe(undefined);
  });

  test('Subscription to an unknown feed is successfully added', () => {
    const request = new Promise<void>((resolve, reject) => {
      const req = https.request(options, (res) => {
        expect(res.statusCode).toBe(201);
        
        res.on('data', () => {});
        res.on('end', () => {
          resolve();
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

    return expect(request).resolves.toBe(undefined);
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
    path: '/api/sub',
  }

  beforeEach(async () => {
    await CLIENT_PG.query(`INSERT INTO folder (folderid, userid, name) VALUES ('0', 'adf8c2ee050b2173', 'folder01')`);
    await CLIENT_PG.query(`INSERT INTO feed (feedid, url, count) VALUES ('0', 'https://app:8082/null.xml', 1)`);
    await CLIENT_PG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('0', '0', '0', 'sub01', 'Mon, 01 Jan 1970 00:00:01 GMT')`);
  });

  afterEach(async () => {
    await CLIENT_PG.query('TRUNCATE TABLE folder, feed, subscription, post, status CASCADE');
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
      req.end();
    })

    return expect(request).resolves.toMatch(new RegExp('Request params could not be parsed'));
  });

  test('Returns 400 if folder does not exist', () => {
    const request = new Promise((resolve, reject) => {
      options.path = '/api/sub?folder=null&name=sub01';

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
      req.end();
    });

    return expect(request).resolves.toMatch(new RegExp('Folder does not exist'));
  });

  test('Returns 400 if subscription does not exist', () => {
    const request = new Promise((resolve, reject) => {
      options.path = '/api/sub?folder=folder01&name=null';

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
      req.end();
    });

    return expect(request).resolves.toMatch(new RegExp('Subscription does not exist'));
  });

  test('Removes feeds without bound subscriptions', async () => {
    await CLIENT_PG.query(`INSERT INTO feed (feedid, url, count) VALUES ('1', 'https://localhost/null', 1)`);
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) values ('0', '0', 'post01', 'Mon, 01 May 1970 00:00:00 GMT', 'http://localhost/null')`);

    const request = new Promise<void>((resolve, reject) => {
      options.path = '/api/sub?folder=folder01&name=sub01';

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
        expect(r.rows[0].feedid).toBe('1');
      });
    });
  });

  test('Removes entries from the status table if user has no other subscriptions to the same feed', async () => {
    await CLIENT_PG.query(`INSERT INTO feed (feedid, url, count) VALUES ('1', 'https://localhost/null', 9)`);
    await CLIENT_PG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('1', '0', '1', 'sub02', 'Mon, 01 Jan 1970 00:00:01 GMT')`);
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) values ('0', '0', 'post01', 'Mon, 01 May 1970 00:00:00 GMT', 'http://localhost/null')`);
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) values ('1', '1', 'post02', 'Mon, 01 May 1970 00:00:00 GMT', 'http://localhost/null')`);
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) values ('2', '1', 'post03', 'Mon, 01 May 1970 00:00:00 GMT', 'http://localhost/null')`);
    await CLIENT_PG.query(`INSERT INTO status (userid, postid, star) VALUES ('adf8c2ee050b2173', '0', true)`);
    await CLIENT_PG.query(`INSERT INTO status (userid, postid, star) VALUES ('adf8c2ee050b2173', '1', true)`);
    await CLIENT_PG.query(`INSERT INTO status (userid, postid, star) VALUES ('adf8c2ee050b2173', '2', true)`);

    const request = new Promise<void>((resolve, reject) => {
      options.path = '/api/sub?folder=folder01&name=sub02';

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
      await CLIENT_PG.query('SELECT postid FROM status').then(r => {
        expect(r.rows.length).toBe(1);
        expect(r.rows[0].postid).toBe('0');
      });
    });
  });

  test('Doesn\'t remove entries from the status table if user has another subscription to the same feed', async () => {
    await CLIENT_PG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('1', '0', '0', 'sub02', 'Mon, 01 Jan 1970 00:00:01 GMT')`);
    await CLIENT_PG.query(`UPDATE feed SET count = 2 WHERE feedid = '0'`);
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) values ('0', '0', 'post01', 'Mon, 01 May 1970 00:00:00 GMT', 'http://localhost/null')`);
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) values ('1', '0', 'post02', 'Mon, 01 May 1970 00:00:01 GMT', 'http://localhost/null')`);
    await CLIENT_PG.query(`INSERT INTO status (userid, postid, star) VALUES ('adf8c2ee050b2173', '0', true)`);
    await CLIENT_PG.query(`INSERT INTO status (userid, postid, star) VALUES ('adf8c2ee050b2173', '1', true)`);

    const request = new Promise<void>((resolve, reject) => {
      options.path = '/api/sub?folder=folder01&name=sub02';

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
      await CLIENT_PG.query('SELECT postid FROM status').then(r => {
        expect(r.rows.length).toBe(2);
        expect(r.rows[0].postid).toBe('0');
        expect(r.rows[1].postid).toBe('1');
      });
    });
  });

  test('Skips dumping cache (among other logic) if subscription never got refreshed', async () => {
    await CLIENT_PG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('1', '0', '0', 'sub02', 'Mon, 01 Jan 1970 00:00:00 GMT')`);
    await CLIENT_RD.hSet('adf8c2ee050b2173:0', 'foo', 'bar');

    const request = new Promise<void>((resolve, reject) => {
      options.path = '/api/sub?folder=folder01&name=sub02';

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
      expect(CLIENT_RD.hLen('adf8c2ee050b2173:0')).resolves.toBe(1);
    });
  });

  test('Dumps the cache for refreshed subscriptions', async () => {
    await CLIENT_RD.hSet('adf8c2ee050b2173:0', 'foo', 'bar');

    const request = new Promise<void>((resolve, reject) => {
      options.path = '/api/sub?folder=folder01&name=sub01';

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
      expect(CLIENT_RD.hLen('adf8c2ee050b2173:0')).resolves.toBe(0);
    });
  });
});
