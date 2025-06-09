import * as https from 'node:https';
import { initPG } from '../../../src/services/db';

import type { Client } from 'pg';

let clientPG: Client;

describe('POST', () => {
  const options = {
    hostname: process.env._HOSTNAME,
    port: 8081,
    headers: {
      'Cookie': '_session="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJfdXNlcmlkIjoiYWRmOGMyZWUwNTBiMjE3MyIsImlzcyI6ImxvY2FsaG9zdCIsImF1ZCI6ImNsaWVudCIsInN1YiI6InNlc3Npb24iLCJpYXQiOjE3NDc2NDU3MjgsImV4cCI6MTgxMDcxNzcyOH0.yz2GqqSA1f9TbWIW54c7qPydqWS5AqZCsUmQOq2jjow"',
    },
    method: 'POST',
    protocol: 'https:',
    path: '/api/refresh',
  }

  beforeAll(async () => {
    clientPG = await initPG('test');
    await clientPG.query(`INSERT INTO folder (folderid, userid, name) VALUES ('1', 'adf8c2ee050b2173', 'folder01')`);
    await clientPG.query(`INSERT INTO folder (folderid, userid, name) VALUES ('2', 'adf8c2ee050b2173', 'folder02')`);
    await clientPG.query(`INSERT INTO feed (feedid, url, count) VALUES ('1', 'https://app:8082/api/blob/func_refresh.xml', 2)`);
    await clientPG.query(`INSERT INTO feed (feedid, url, count) VALUES ('2', 'https://app:8082/api/blob/null.xml', 1)`);
    await clientPG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('1', '1', '1', 'sub01', 'Mon, 01 Jan 1972 00:00:00 GMT')`);
    await clientPG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('2', '2', '1', 'sub02', 'Mon, 01 Jan 1972 00:00:00 GMT')`);
    await clientPG.query(`INSERT INTO subscription (subid, folderid, feedid, name, refresh_date) VALUES ('3', '1', '2', 'sub03', 'Mon, 01 Jan 1972 00:00:00 GMT')`);
    await clientPG.query(`INSERT INTO post (postid, feedid, title, date, content, url) values ('8b88c521887fc212', '1', '03', 'Mon, 01 May 1970 00:00:02 GMT', 'content', 'http://localhost/03.html')`);
    await clientPG.query(`INSERT INTO post (postid, feedid, title, date, content, url) values ('594cec3df5f1b22c', '1', '06', 'Mon, 01 Jan 1970 00:00:00 GMT', 'content', 'http://localhost/06.html')`);
    await clientPG.query(`INSERT INTO post (postid, feedid, title, date, content, url) values ('3f2730225463f8f5', '2', '00', 'Mon, 01 Jan 1970 00:00:00 GMT', 'content', 'http://localhost/null.html')`);
    await clientPG.query(`INSERT INTO status (userid, postid, star) VALUES ('adf8c2ee050b2173', '594cec3df5f1b22c', true)`);
  });

  afterAll(async () => {
    await clientPG.query('TRUNCATE TABLE folder, feed, subscription, post, status');
    await clientPG.end();
  });
  
  test('Returns 400 if parameters are missing', () => {
    const request = new Promise((resolve, reject) => {
      const req = https.request(options, (res) => { let data = '';

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
    // call again for the other folder
  });

  test('Returns 400 if folder does not exist', () => {
    const request = new Promise((resolve, reject) => {
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

      req.write(JSON.stringify(
        { name: 'null', folder: 'null', url: 'https://localhost/rss.xml' }
      ));
        
      req.end();
    });

    return expect(request).resolves.toMatch(new RegExp('Folder does not exist'));
  });

  test('Returns 201 if posts are successfully added', async () => {
    const request = new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (d: string) => {
          data += d;
        });
        
        res.on('end', () => {
          resolve(res.statusCode);
        });
      });

      req.on('error', (e) => {
        reject(e);
      });

      req.write(JSON.stringify(
        { folder: "folder02" }
      ));
        
      req.end();
    })

    expect(await request).toBe(201);

    const feed01 = await clientPG.query(`SELECT * FROM post WHERE feedid = '1' ORDER BY date DESC`).then(r => r.rows);
    console.log(feed01);
    expect(feed01.length).toBe(4);
    expect(feed01[0].postid).toBe('ff197ba8f031bd29');
    expect(feed01[1].postid).toBe('04f3362fc426a395');
    expect(feed01[2].postid).toBe('580d8a7078c23a0a');
    expect(feed01[3].postid).toBe('594cec3df5f1b22c');

    const feed02 = await clientPG.query(`SELECT * FROM post WHERE feedid = '2' ORDER BY date DESC`).then(r => r.rows);
    console.log(feed02);
    expect(feed02.length).toBe(1);
    expect(feed02[0].postid).toBe('3f2730225463f8f5');
  });
});
