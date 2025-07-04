import * as https from 'node:https';

describe('GET', () => {
  test('Returns 200 and found feed URLs', () => {
    const options = {
      hostname: 'app',
      port: 8081,
      headers: {
        'Cookie': '_session="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJfdXNlcmlkIjoiYWRmOGMyZWUwNTBiMjE3MyIsImlzcyI6ImxvY2FsaG9zdCIsImF1ZCI6ImNsaWVudCIsInN1YiI6InNlc3Npb24iLCJpYXQiOjE3NDc2NDU3MjgsImV4cCI6MTgxMDcxNzcyOH0.yz2GqqSA1f9TbWIW54c7qPydqWS5AqZCsUmQOq2jjow"',
      },
      method: 'GET',
      protocol: 'https:',
      path: '/api/scrape?site=https%3A%2F%2Fapp%3A8082%2Fapi%2Fblob%2Ffunc_scrape.html',
    }

    const request = new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk: Buffer) => {
          data += chunk;
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

    return expect(request).resolves.toBe('[{"title":"rss","href":"https://app:8082/feed.rss"},{"title":"atom","href":"https://app:8082/feed.atom"}]');
  });
});
