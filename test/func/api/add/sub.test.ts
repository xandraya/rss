import * as https from 'node:https';
import { initPG } from '../../../../src/services/db';

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
    path: '/api/add/sub',
  }

  beforeAll(async () => {
    clientPG = await initPG('test');
    await clientPG.query(`INSERT INTO folder (folderid, userid, name) VALUES ('1', 'adf8c2ee050b2173', 'fail')`);
    await clientPG.query(`INSERT INTO folder (folderid, userid, name) VALUES ('2', 'adf8c2ee050b2173', 'success')`);
    await clientPG.query(`INSERT INTO feed (feedid, url, count) VALUES ('1', 'https://localhost/rss.xml', 2)`);
    await clientPG.query(`INSERT INTO subscription (subid, name) VALUES ('1', 'sameName')`);
    await clientPG.query(`INSERT INTO subscription (subid, folderid, feedid, name) VALUES ('2', '1', '1', 'sameUrl')`);
  });

  afterAll(async () => {
    await clientPG.query('TRUNCATE TABLE folder, feed, subscription, post, status');
    await clientPG.end();
  });

  test('Returns 400 if parameters are missing', () => {
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
        { foo: "bar" }
      ));
        
      req.end();
    })

    return expect(request).resolves.toMatch(new RegExp('Request params could not be parsed'));
  });

  test('Returns 400 if subscription with the same name already exists', () => {
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
        { name: 'sameName', folder: 'fail', url: 'null' }
      ));
        
      req.end();
    });

    return expect(request).resolves.toMatch(new RegExp('Subscription with this name already exists'));
  });

  test('Returns 400 if subscription to the same feed already exists', () => {
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
        { name: 'null', folder: 'fail', url: 'https://localhost/rss.xml' }
      ));
        
      req.end();
    });

    return expect(request).resolves.toMatch(new RegExp('Subscription to this feed already exists'));
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

  test('Returns 201 if subscription to an already known feed is successfully added', () => {
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
        { name: 'addKnown', folder: 'success', url: 'https://localhost/rss.xml' }
      ));
        
      req.end();
    });

    return expect(request).resolves.toBe(201);
  });

  test('Returns 201 if subscription to an unknown feed is successfully added', () => {
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
        { name: 'addUnknown', folder: 'success', url: 'https://localhost/atom.xml' }
      ));
        
      req.end();
    });

    return expect(request).resolves.toBe(201);
  });
});
