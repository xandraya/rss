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
    path: '/api/folder',
  }

  beforeAll(async () => {
    await CLIENT_PG.query(`INSERT INTO folder (folderid, userid, name) VALUES ('0', '${process.env._TEST_USERID}', 'folder01')`);
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

  test('Returns 400 if folder already exists', () => {
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
        { name: "folder01" }
      ));
      req.end();
    });

    return expect(request).resolves.toMatch(new RegExp('Folder name already exists'));
  });

  test('Successfully adds the folder and dumps the cache', async () => {
    await CLIENT_RD.sAdd(`${process.env._TEST_USERID}:folderlist`, 'foo');

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
        { name: "folder02" }
      ));
      req.end();
    });

    return request.then(async () => {
      expect(CLIENT_RD.hLen(`${process.env._TEST_USERID}:folderlist`)).resolves.toBe(0);
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
    path: '/api/folder',
  }

  beforeEach(async () => {
    await CLIENT_PG.query(`INSERT INTO folder (folderid, userid, name) VALUES ('0', '${process.env._TEST_USERID}', 'folder01')`);
    await CLIENT_PG.query(`INSERT INTO folder (folderid, userid, name) VALUES ('1', '${process.env._TEST_USERID}', 'folder02')`);
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
      options.path = '/api/folder?name=null';

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

  test('Removes feeds without bound subscriptions', async () => {
    await CLIENT_PG.query(`INSERT INTO feed (feedid, url, count) VALUES ('0', 'https://localhost/null', 1)`);
    await CLIENT_PG.query(`INSERT INTO feed (feedid, url, count) VALUES ('1', 'https://localhost/null', 1)`);
    await CLIENT_PG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('0', '0', '0', 'sub01', 'Mon, 01 Jan 1970 00:00:00 GMT')`);
    await CLIENT_PG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('1', '1', '1', 'sub02', 'Mon, 01 Jan 1970 00:00:00 GMT')`);
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) values ('0', '1', 'post01', 'Mon, 01 May 1970 00:00:00 GMT', 'http://localhost/null')`);

    const request = new Promise<void>((resolve, reject) => {
      options.path = '/api/folder?name=folder02';

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
        expect(r.rows[0].feedid).toBe('0');
      });
    });
  });

  test('Removes folder and sub entries', async () => {
    await CLIENT_PG.query(`INSERT INTO feed (feedid, url, count) VALUES ('0', 'https://localhost/null', 1)`);
    await CLIENT_PG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('0', '1', '0', 'sub01', 'Mon, 01 Jan 1970 00:00:00 GMT')`);

    const request = new Promise<void>((resolve, reject) => {
      options.path = '/api/folder?name=folder02';

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
      await CLIENT_PG.query('SELECT folderid FROM folder').then(r => {
        expect(r.rows.length).toBe(1);
        expect(r.rows[0].folderid).toBe('0');
      });
      await CLIENT_PG.query('SELECT subid FROM subscription').then(r => expect(r.rows.length).toBe(0));
    });
  });

  test('Removes entries from the status table corresponding to posts that don\'t belong to any of the users subs', async () => {
    await CLIENT_PG.query(`INSERT INTO feed (feedid, url, count) VALUES ('0', 'https://localhost/null', 9)`);
    await CLIENT_PG.query(`INSERT INTO feed (feedid, url, count) VALUES ('1', 'https://localhost/null', 9)`);
    await CLIENT_PG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('0', '0', '0', 'sub01', 'Mon, 01 Jan 1970 00:00:00 GMT')`);
    await CLIENT_PG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('1', '1', '0', 'sub02', 'Mon, 01 Jan 1970 00:00:00 GMT')`);
    await CLIENT_PG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('2', '1', '1', 'sub03', 'Mon, 01 Jan 1970 00:00:00 GMT')`);
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) values ('0', '0', 'post01', 'Mon, 01 May 1970 00:00:00 GMT', 'http://localhost/null')`);
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) values ('1', '1', 'post02', 'Mon, 01 May 1970 00:00:00 GMT', 'http://localhost/null')`);
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) values ('2', '1', 'post03', 'Mon, 01 May 1970 00:00:00 GMT', 'http://localhost/null')`);
    await CLIENT_PG.query(`INSERT INTO status (userid, postid, star) VALUES ('${process.env._TEST_USERID}', '0', true)`);
    await CLIENT_PG.query(`INSERT INTO status (userid, postid, star) VALUES ('${process.env._TEST_USERID}', '1', true)`);
    await CLIENT_PG.query(`INSERT INTO status (userid, postid, star) VALUES ('${process.env._TEST_USERID}', '2', true)`);

    const request = new Promise<void>((resolve, reject) => {
      options.path = '/api/folder?name=folder02';

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

  test('Dumps the cache', async () => {
    await CLIENT_RD.hSet(`${process.env._TEST_USERID}:0`, 'foo', 'bar');

    const request = new Promise<void>((resolve, reject) => {
      options.path = '/api/folder?name=folder01';

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
      expect(CLIENT_RD.hLen(`${process.env._TEST_USERID}:0`)).resolves.toBe(0);
    });
  });
});
