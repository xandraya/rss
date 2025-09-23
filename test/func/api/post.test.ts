import * as https from 'node:https';
import { initPG, initRD } from '../../../src/services/db';

import type { Client } from 'pg';
import { isPostArray } from '../../../src/services/misc';

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
    path: '/api/post',
  }

  beforeAll(async () => {
    await CLIENT_PG.query(`INSERT INTO folder (folderid, userid, name) VALUES ('1', 'adf8c2ee050b2173', 'folder01')`);
    await CLIENT_PG.query(`INSERT INTO feed (feedid, url, count) VALUES ('1', 'https://app:8082/null.xml', 1)`);
    await CLIENT_PG.query(`INSERT INTO feed (feedid, url, count) VALUES ('2', 'https://app:8082/null.xml', 1)`);
    await CLIENT_PG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('1', '1', '1', 'sub01', 'Mon, 01 Jan 1972 00:00:00 GMT')`);
    await CLIENT_PG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('2', '1', '2', 'sub02', 'Mon, 01 Jan 1972 00:00:00 GMT')`);
  });

  afterEach(async () => {
    await CLIENT_PG.query('TRUNCATE TABLE post, status CASCADE');

    for await (const key of CLIENT_RD.scanIterator({ TYPE: "hash" }))
      await CLIENT_RD.del(key);
  });

  afterAll(async () => {
    await CLIENT_PG.query('TRUNCATE TABLE folder, feed, subscription, post, status CASCADE');
  });
  
  test('Returns 400 if parameters are missing', () => {
    const request = new Promise((resolve, reject) => {
      options.path = '/api/post?foo=bar';

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
      options.path = '/api/post?folder=null';

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

  test('Returns 200 and fetches posts that are not 1yr older than the oldest subscriptions refresh_date', async () => {
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('1', '1', 'ignored', 'Mon, 01 Jan 1970 00:00:00 GMT', 'null')`);
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('2', '1', 'added', 'Mon, 01 Jun 1971 00:00:00 GMT', 'null')`);
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('3', '2', 'added', 'Mon, 01 Jun 1971 00:00:00 GMT', 'null')`);

    const request = new Promise((resolve, reject) => {
      options.path = '/api/post?folder=folder01';
      
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
    });

    return request.then(res => {
      if (!isPostArray(res)) throw new Error();

      expect(res.length).toBe(2);
      for (let post of res)
        expect(post.title).toBe('added');
    });
  });

  test('Returns 200 and fetches only SUB_POST_LIMIT amount of posts per subscription', async () => {
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('1', '1', 'added', 'Mon, 01 Jun 1971 00:00:04 GMT', 'null')`);
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('2', '1', 'added', 'Mon, 01 Jun 1971 00:00:03 GMT', 'null')`);
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('3', '1', 'added', 'Mon, 01 Jun 1971 00:00:02 GMT', 'null')`);
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('4', '1', 'ignored', 'Mon, 01 Jun 1971 00:00:01 GMT', 'null')`);
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('5', '2', 'added', 'Mon, 01 Jun 1971 00:00:00 GMT', 'null')`);

    const request = new Promise((resolve, reject) => {
      options.path = '/api/post?folder=folder01&page=2';
      
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
    });

    return request.then(res => {
      if (!isPostArray(res)) throw new Error();

      expect(res.length).toBe(2);
      for (let post of res)
        expect(post.title).toBe('added');
    });
  });

  test('Returns 200 and fetches only posts that have the READ flag', async () => {
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('1', '1', 'added', 'Mon, 01 Jun 1971 00:00:04 GMT', 'null')`);
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('2', '1', 'ignored', 'Mon, 01 Jun 1971 00:00:03 GMT', 'null')`);
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('3', '2', 'added', 'Mon, 01 Jun 1971 00:00:00 GMT', 'null')`);
    await CLIENT_PG.query(`INSERT INTO status (userid, postid, read) VALUES ('adf8c2ee050b2173', '1', true)`);
    await CLIENT_PG.query(`INSERT INTO status (userid, postid, read) VALUES ('adf8c2ee050b2173', '3', true)`);

    const request = new Promise((resolve, reject) => {
      options.path = '/api/post?folder=folder01&read=true';
      
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
    });

    return request.then(res => {
      if (!isPostArray(res)) throw new Error();

      expect(res.length).toBe(2);
      for (let post of res)
        expect(post.title).toBe('added');
    });
  });

  test('Returns 200 and fetches only posts that have the STAR flag', async () => {
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('1', '1', 'added', 'Mon, 01 Jun 1971 00:00:04 GMT', 'null')`);
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('2', '1', 'ignored', 'Mon, 01 Jun 1971 00:00:03 GMT', 'null')`);
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('3', '2', 'added', 'Mon, 01 Jun 1971 00:00:00 GMT', 'null')`);
    await CLIENT_PG.query(`INSERT INTO status (userid, postid, star) VALUES ('adf8c2ee050b2173', '1', true)`);
    await CLIENT_PG.query(`INSERT INTO status (userid, postid, star) VALUES ('adf8c2ee050b2173', '3', true)`);

    const request = new Promise((resolve, reject) => {
      options.path = '/api/post?folder=folder01&star=true';
      
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
    });

    return request.then(res => {
      if (!isPostArray(res)) throw new Error();

      expect(res.length).toBe(2);
      for (let post of res)
        expect(post.title).toBe('added');
    });
  });

  test('Returns 200 and sorts fetched posts ascending alphabetically', async () => {
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('1', '1', 'A', 'Mon, 01 Jun 1971 00:00:01 GMT', 'null')`);
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('2', '2', 'B', 'Mon, 01 Jun 1971 00:00:00 GMT', 'null')`);

    const request = new Promise((resolve, reject) => {
      options.path = '/api/post?folder=folder01&sort=alpha_asc';
      
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
    });

    return request.then(res => {
      if (!isPostArray(res)) throw new Error();

      expect(res.length).toBe(2);
      expect(res[0].title).toBe('A');
      expect(res[1].title).toBe('B');
    });
  });

  test('Returns 200 and sorts fetched posts descending alphabetically', async () => {
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('1', '1', 'A', 'Mon, 01 Jun 1971 00:00:01 GMT', 'null')`);
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('2', '2', 'B', 'Mon, 01 Jun 1971 00:00:00 GMT', 'null')`);

    const request = new Promise((resolve, reject) => {
      options.path = '/api/post?folder=folder01&sort=alpha_desc';
      
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
    });

    return request.then(res => {
      if (!isPostArray(res)) throw new Error();

      expect(res.length).toBe(2);
      expect(res[0].title).toBe('B');
      expect(res[1].title).toBe('A');
    });
  });

  test('Returns 200 and sorts fetched posts ascending by date', async () => {
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('1', '1', 'A', 'Mon, 01 Jun 1971 00:00:01 GMT', 'null')`);
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('2', '2', 'B', 'Mon, 01 Jun 1971 00:00:00 GMT', 'null')`);

    const request = new Promise((resolve, reject) => {
      options.path = '/api/post?folder=folder01&sort=date_asc';
      
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
    });

    return request.then(res => {
      if (!isPostArray(res)) throw new Error();

      expect(res.length).toBe(2);
      expect(res[0].title).toBe('B');
      expect(res[1].title).toBe('A');
    });
  });

  test('Returns 200 and sorts fetched posts descending by date', async () => {
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('1', '1', 'A', 'Mon, 01 Jun 1971 00:00:01 GMT', 'null')`);
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('2', '2', 'B', 'Mon, 01 Jun 1971 00:00:00 GMT', 'null')`);

    const request = new Promise((resolve, reject) => {
      options.path = '/api/post?folder=folder01&sort=date_desc';
      
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
    });

    return request.then(res => {
      if (!isPostArray(res)) throw new Error();

      expect(res.length).toBe(2);
      expect(res[0].title).toBe('A');
      expect(res[1].title).toBe('B');
    });
  });

  test('Returns 200 and caches the query', async () => {
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('1', '1', 'post01', 'Mon, 01 Jun 1971 00:00:00 GMT', 'null')`);
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('2', '2', 'post02', 'Mon, 01 Jun 1971 00:00:00 GMT', 'null')`);

    const request = new Promise((resolve, reject) => {
      options.path = '/api/post?folder=folder01';
      
      const req = https.request(options, (res) => {
        res.on('data', () => {});
        res.on('end', () => {
          resolve(res.statusCode);
        });
      });

      req.on('error', (e) => {
        reject(e);
      });
      req.end();
    });
    
    return request.then(async (res) => {
      await CLIENT_RD.hKeys('adf8c2ee050b2173:1').then((r: string[]) => expect(r[0]).toBe('000100:1'));
      expect(res).toBe(200);
    });
  });
  
  test('Returns 200 and an empty array if no posts are found', async () => {
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('1', '1', 'post01', 'Mon, 01 Jun 1971 00:00:00 GMT', 'null')`);
    await CLIENT_PG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('2', '2', 'post02', 'Mon, 01 Jun 1971 00:00:00 GMT', 'null')`);

    const request = new Promise((resolve, reject) => {
      options.path = '/api/post?folder=folder01&page=2';
      
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
    });

    return request.then(res => {
      if (!isPostArray(res)) throw new Error();
      expect(res.length).toBe(0);
    });
  });
});
