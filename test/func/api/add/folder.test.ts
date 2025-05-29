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
    path: '/api/add/folder',
  }

  beforeAll(async () => {
    clientPG = await initPG('test');
    await clientPG.query(`INSERT INTO folder (folderid, userid, name) VALUES ('2b9d34170d53c39a', 'adf8c2ee050b2173', 'existingfolder')`);
  });

  afterAll(async () => {
    await clientPG.query('DELETE FROM folder');
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

  test('Returns 400 if folder already exists', () => {
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
        { folder: "existingfolder" }
      ));
        
      req.end();
    });

    return expect(request).resolves.toMatch(new RegExp('Folder name already exists'));
  });

  test('Returns 201 if folder is successfully added', () => {
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
        { folder: "newfolder" }
      ));
        
      req.end();
    });

    return expect(request).resolves.toBe(201);
  });
});
