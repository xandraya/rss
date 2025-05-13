import * as https from 'node:https';
import * as fs from 'node:fs';

const options = {
  hostname: 'app',
  port: 8080,
  headers: {
    'Cookie': '_test="true"; _session="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJfdXNlcmlkIjoiN2Y2NWY2YTRmNGIxYzVmNyIsImlzcyI6ImxvY2FsaG9zdCIsImF1ZCI6ImNsaWVudCIsInN1YiI6InNlc3Npb24iLCJpYXQiOjE3NDcxMjA5ODYsImV4cCI6MTc0NzI5Mzc4Nn0.fH3wJdEo_HJ7W1gmggi4v-hCblPJLKM71cno-joZ-to"',
  },
  method: 'POST',
  protocol: 'https:',
  path: '/api/add/folder',
  ca: fs.readFileSync('./key/cacert.pem'),
}

describe('POST', () => {
  test('Returns 400 if data is malformed', async () => {
    return new Promise((resolve, reject) => {
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

      req.write('foobar');
        
      req.end();
    }).then(r => expect(r).toMatch(new RegExp('Request could not be parsed')));
  });

  test('Returns 400 if folder already exists', async () => {
    return new Promise((resolve, reject) => {
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

      req.write('{ "name": "existingfolder" }');
        
      req.end();
    }).then(r => expect(r).toMatch(new RegExp('Folder name already exists')));
  });

  test('Returns 201 if folder is successfully added', async () => {
    return new Promise((resolve, reject) => {
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

      req.write('{ "name": "newfolder" }');
        
      req.end();
    }).then(r => expect(r).toBe(201));
  });
});
