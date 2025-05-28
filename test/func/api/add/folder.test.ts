import * as https from 'node:https';

describe('POST', () => {
  const options = {
    hostname: 'app',
    port: 8081,
    headers: {
      'Cookie': '_session="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJfdXNlcmlkIjoiYWRmOGMyZWUwNTBiMjE3MyIsImlzcyI6ImxvY2FsaG9zdCIsImF1ZCI6ImNsaWVudCIsInN1YiI6InNlc3Npb24iLCJpYXQiOjE3NDc2NDU3MjgsImV4cCI6MTgxMDcxNzcyOH0.yz2GqqSA1f9TbWIW54c7qPydqWS5AqZCsUmQOq2jjow"',
    },
    method: 'POST',
    protocol: 'https:',
    path: '/api/add/folder',
  }

  test('Returns 400 if data is malformed', () => {
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

      req.write('foobar');
        
      req.end();
    })

    expect(request).resolves.toMatch(new RegExp('Request could not be parsed'));
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

      req.write('{ "name": "existingfolder" }');
        
      req.end();
    });

    expect(request).resolves.toMatch(new RegExp('Folder name already exists'));
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

      req.write('{ "name": "newfolder" }');
        
      req.end();
    });

    expect(request).resolves.toBe(201);
  });
});
