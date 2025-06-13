import * as https from 'node:https';
import { initPG } from '../../../../src/services/db';

import type { Client } from 'pg';
import { isPostArray } from '../../../../src/services/misc';

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
    path: '/api/fetch/post',
  }

  beforeAll(async () => {
    clientPG = await initPG('test');
    await clientPG.query(`INSERT INTO folder (folderid, userid, name) VALUES ('1', 'adf8c2ee050b2173', 'folder01')`);
  });

  afterEach(async () => {
    await clientPG.query('TRUNCATE TABLE feed, subscription, post, status');
  });

  afterAll(async () => {
    await clientPG.query('TRUNCATE TABLE folder CASCADE');
    await clientPG.end();
  });
  
  test('Returns 400 if parameters are missing', () => {
    const request = new Promise((resolve, reject) => {
      options.path = '/api/fetch/post?foo=bar';

      const req = https.request(options, (res) => { 
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
      options.path = '/api/fetch/post?folder=null';

      const req = https.request(options, (res) => {
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

  test('Ignores posts 1yr older than the subscriptions refresh_date', async () => {
    await clientPG.query(`INSERT INTO feed (feedid, url, count) VALUES ('1', 'https://app:8082/null.xml', 1)`);
    await clientPG.query(`INSERT INTO feed (feedid, url, count) VALUES ('2', 'https://app:8082/null.xml', 1)`);
    await clientPG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('1', '1', '1', 'sub01', 'Mon, 01 Jan 1972 00:00:00 GMT')`);
    await clientPG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('2', '1', '2', 'sub02', 'Mon, 01 Jan 1972 00:00:00 GMT')`);
    await clientPG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('1', '1', 'ignored', 'Mon, 01 Jan 1970 00:00:00 GMT', 'null')`);
    await clientPG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('2', '1', 'added', 'Mon, 01 Jun 1971 00:00:00 GMT', 'null')`);
    await clientPG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('3', '2', 'added', 'Mon, 01 Jun 1971 00:00:00 GMT', 'null')`);

    const request = new Promise((resolve, reject) => {
      options.path = '/api/fetch/post?folder=folder01';
      
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
    });

    return request.then(res => {
      if (!isPostArray(res)) throw new Error();

      expect(res.length).toBe(2);
      for (let post of res)
        expect(post.title).toBe('added');
    });
  });

  test('Fetches only SUB_POST_LIMIT amount of posts per subscription', async () => {
    await clientPG.query(`INSERT INTO feed (feedid, url, count) VALUES ('1', 'https://app:8082/null.xml', 1)`);
    await clientPG.query(`INSERT INTO feed (feedid, url, count) VALUES ('2', 'https://app:8082/null.xml', 1)`);
    await clientPG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('1', '1', '1', 'sub01', 'Mon, 01 Jan 1972 00:00:00 GMT')`);
    await clientPG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('2', '1', '2', 'sub02', 'Mon, 01 Jan 1972 00:00:00 GMT')`);
    await clientPG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('1', '1', 'added', 'Mon, 01 Jun 1971 00:00:04 GMT', 'null')`);
    await clientPG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('2', '1', 'added', 'Mon, 01 Jun 1971 00:00:03 GMT', 'null')`);
    await clientPG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('3', '1', 'added', 'Mon, 01 Jun 1971 00:00:02 GMT', 'null')`);
    await clientPG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('4', '1', 'ignored', 'Mon, 01 Jun 1971 00:00:00 GMT', 'null')`);
    await clientPG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('5', '2', 'added', 'Mon, 01 Jun 1971 00:00:00 GMT', 'null')`);

    const request = new Promise((resolve, reject) => {
      options.path = '/api/fetch/post?folder=folder01&pagenum=2';
      
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
    });

    return request.then(res => {
      if (!isPostArray(res)) throw new Error();

      expect(res.length).toBe(2);
      for (let post of res)
        expect(post.title).toBe('added');
    });
  });

  test('Fetches only posts that have the READ flag', async () => {
    await clientPG.query(`INSERT INTO feed (feedid, url, count) VALUES ('1', 'https://app:8082/null.xml', 1)`);
    await clientPG.query(`INSERT INTO feed (feedid, url, count) VALUES ('2', 'https://app:8082/null.xml', 1)`);
    await clientPG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('1', '1', '1', 'sub01', 'Mon, 01 Jan 1972 00:00:00 GMT')`);
    await clientPG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('2', '1', '2', 'sub02', 'Mon, 01 Jan 1972 00:00:00 GMT')`);
    await clientPG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('1', '1', 'added', 'Mon, 01 Jun 1971 00:00:04 GMT', 'null')`);
    await clientPG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('2', '1', 'ignored', 'Mon, 01 Jun 1971 00:00:03 GMT', 'null')`);
    await clientPG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('3', '2', 'added', 'Mon, 01 Jun 1971 00:00:00 GMT', 'null')`);
    await clientPG.query(`INSERT INTO status (userid, postid, read) VALUES ('adf8c2ee050b2173', '1', true)`);
    await clientPG.query(`INSERT INTO status (userid, postid, read) VALUES ('adf8c2ee050b2173', '3', true)`);

    const request = new Promise((resolve, reject) => {
      options.path = '/api/fetch/post?folder=folder01&read=true';
      
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
    });

    return request.then(res => {
      if (!isPostArray(res)) throw new Error();

      expect(res.length).toBe(2);
      for (let post of res)
        expect(post.title).toBe('added');
    });
  });

  test('Fetches only posts that have the STAR flag', async () => {
    await clientPG.query(`INSERT INTO feed (feedid, url, count) VALUES ('1', 'https://app:8082/null.xml', 1)`);
    await clientPG.query(`INSERT INTO feed (feedid, url, count) VALUES ('2', 'https://app:8082/null.xml', 1)`);
    await clientPG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('1', '1', '1', 'sub01', 'Mon, 01 Jan 1972 00:00:00 GMT')`);
    await clientPG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('2', '1', '2', 'sub02', 'Mon, 01 Jan 1972 00:00:00 GMT')`);
    await clientPG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('1', '1', 'added', 'Mon, 01 Jun 1971 00:00:04 GMT', 'null')`);
    await clientPG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('2', '1', 'ignored', 'Mon, 01 Jun 1971 00:00:03 GMT', 'null')`);
    await clientPG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('3', '2', 'added', 'Mon, 01 Jun 1971 00:00:00 GMT', 'null')`);
    await clientPG.query(`INSERT INTO status (userid, postid, star) VALUES ('adf8c2ee050b2173', '1', true)`);
    await clientPG.query(`INSERT INTO status (userid, postid, star) VALUES ('adf8c2ee050b2173', '3', true)`);

    const request = new Promise((resolve, reject) => {
      options.path = '/api/fetch/post?folder=folder01&star=true';
      
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
    });

    return request.then(res => {
      if (!isPostArray(res)) throw new Error();

      expect(res.length).toBe(2);
      for (let post of res)
        expect(post.title).toBe('added');
    });
  });

  test('Sorts posts ascending alphabetically', async () => {
    await clientPG.query(`INSERT INTO feed (feedid, url, count) VALUES ('1', 'https://app:8082/null.xml', 1)`);
    await clientPG.query(`INSERT INTO feed (feedid, url, count) VALUES ('2', 'https://app:8082/null.xml', 1)`);
    await clientPG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('1', '1', '1', 'sub01', 'Mon, 01 Jan 1972 00:00:00 GMT')`);
    await clientPG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('2', '1', '2', 'sub02', 'Mon, 01 Jan 1972 00:00:00 GMT')`);
    await clientPG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('1', '1', 'A', 'Mon, 01 Jun 1971 00:00:01 GMT', 'null')`);
    await clientPG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('2', '2', 'B', 'Mon, 01 Jun 1971 00:00:00 GMT', 'null')`);

    const request = new Promise((resolve, reject) => {
      options.path = '/api/fetch/post?folder=folder01&sort=alpha_asc';
      
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
    });

    return request.then(res => {
      if (!isPostArray(res)) throw new Error();

      expect(res.length).toBe(2);
        expect(res[0].title).toBe('A');
        expect(res[1].title).toBe('B');
    });
  });

  test('Sorts posts descending alphabetically', async () => {
    await clientPG.query(`INSERT INTO feed (feedid, url, count) VALUES ('1', 'https://app:8082/null.xml', 1)`);
    await clientPG.query(`INSERT INTO feed (feedid, url, count) VALUES ('2', 'https://app:8082/null.xml', 1)`);
    await clientPG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('1', '1', '1', 'sub01', 'Mon, 01 Jan 1972 00:00:00 GMT')`);
    await clientPG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('2', '1', '2', 'sub02', 'Mon, 01 Jan 1972 00:00:00 GMT')`);
    await clientPG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('1', '1', 'A', 'Mon, 01 Jun 1971 00:00:01 GMT', 'null')`);
    await clientPG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('2', '2', 'B', 'Mon, 01 Jun 1971 00:00:00 GMT', 'null')`);

    const request = new Promise((resolve, reject) => {
      options.path = '/api/fetch/post?folder=folder01&sort=alpha_desc';
      
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
    });

    return request.then(res => {
      if (!isPostArray(res)) throw new Error();

      expect(res.length).toBe(2);
        expect(res[0].title).toBe('B');
        expect(res[1].title).toBe('A');
    });
  });

  test('Sorts posts ascending by date', async () => {
    await clientPG.query(`INSERT INTO feed (feedid, url, count) VALUES ('1', 'https://app:8082/null.xml', 1)`);
    await clientPG.query(`INSERT INTO feed (feedid, url, count) VALUES ('2', 'https://app:8082/null.xml', 1)`);
    await clientPG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('1', '1', '1', 'sub01', 'Mon, 01 Jan 1972 00:00:00 GMT')`);
    await clientPG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('2', '1', '2', 'sub02', 'Mon, 01 Jan 1972 00:00:00 GMT')`);
    await clientPG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('1', '1', 'A', 'Mon, 01 Jun 1971 00:00:01 GMT', 'null')`);
    await clientPG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('2', '2', 'B', 'Mon, 01 Jun 1971 00:00:00 GMT', 'null')`);

    const request = new Promise((resolve, reject) => {
      options.path = '/api/fetch/post?folder=folder01&sort=date_asc';
      
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
    });

    return request.then(res => {
      if (!isPostArray(res)) throw new Error();

      expect(res.length).toBe(2);
        expect(res[0].title).toBe('B');
        expect(res[1].title).toBe('A');
    });
  });

  test('Sorts posts descending by date', async () => {
    await clientPG.query(`INSERT INTO feed (feedid, url, count) VALUES ('1', 'https://app:8082/null.xml', 1)`);
    await clientPG.query(`INSERT INTO feed (feedid, url, count) VALUES ('2', 'https://app:8082/null.xml', 1)`);
    await clientPG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('1', '1', '1', 'sub01', 'Mon, 01 Jan 1972 00:00:00 GMT')`);
    await clientPG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('2', '1', '2', 'sub02', 'Mon, 01 Jan 1972 00:00:00 GMT')`);
    await clientPG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('1', '1', 'A', 'Mon, 01 Jun 1971 00:00:01 GMT', 'null')`);
    await clientPG.query(`INSERT INTO post (postid, feedid, title, date, url) VALUES ('2', '2', 'B', 'Mon, 01 Jun 1971 00:00:00 GMT', 'null')`);

    const request = new Promise((resolve, reject) => {
      options.path = '/api/fetch/post?folder=folder01&sort=date_desc';
      
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
    });

    return request.then(res => {
      if (!isPostArray(res)) throw new Error();

      expect(res.length).toBe(2);
        expect(res[0].title).toBe('A');
        expect(res[1].title).toBe('B');
    });
  });
});
