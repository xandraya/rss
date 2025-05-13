import * as https from 'node:https';
import * as fs from 'node:fs';

import * as db from './services/db';
import { sendMessage } from './services/misc';
import { handle404, handle500 } from './services/error';

import * as login from './auth/local/login';
import * as register from './auth/local/register';
import * as secret from './api/secret';
import * as folder from './api/add/folder';

import type { SystemError } from './types.d';

export default async function initServer(wrkID: number) {
  if (!process.env._JWT_KEY) throw new Error('JWT Key not initialized');
  if (!process.env.HOST) throw new Error('Hostname not initialized');
  if (!process.env.PORT) throw new Error('Global port not initialized');

  //const tlsSessionStore = new Map<string, Buffer>();
  const clientPg = await db.initPg();
  const clientRedis = await db.initRedis();
  //const scraper = await db.initScraper();
  //await db.dropTables(clientPg);
  await db.createTables(clientPg);

  const serverOptions = Object.freeze({
    // net.createServer
    //pauseOnConnect: true, // workers?
    
    // http.createServer
    keepAlive: true,
    keepAliveInitialDelay: 45,
    keepAliveTimeout: 100000000, // ???
    //headersTimeout: 60000,
    //requestTimeout: 300000,

    //tls.createServer
    //ticketKeys: null, // session resume?

    // tls.createSecureContext
    key: fs.readFileSync('./key/serverkey.pem'),
    cert: fs.readFileSync('./key/servercert.pem'),
    passphrase: 'foobar',
    minVersion: 'TLSv1.2',
    maxVersion: 'TLSv1.3',
  });

  const listenOptions = Object.freeze({
    //host: '0.0.0.0',
    port: 8080,
    //exclusive: true,
  });

  const server = https.createServer(serverOptions);

  server.on('error', (err: SystemError) => {
    switch (err.code) {
      case 'EADDRINUSE':
        sendMessage(wrkID, 'Address in use; Retrying in 1m...');
        setTimeout(() => {
          server.close();
          server.listen(listenOptions);
        }, 1000*60);
        break;
      default:
        sendMessage(wrkID, `Unhandled exception; Closing Worker ${wrkID}`);
        server.close();
        process.exit(1);
    }
  });

  server.on('clientError', (err: SystemError, socket) => {
    switch (err.code) {
      case 'HPE_HEADER_OVERFLOW':
        socket.writable && socket.end('HTTP/1.1 431 Request Header Fields Too Large\r\n\r\n');
        break;
      case 'ECONNRESET':
        break;
      default:
        socket.writable && socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        break;
    }
  });

  /*
  server.on('newSession', (id, data, cb: () => void) => {
    tlsSessionStore.set(id.toString('hex'), data);
    cb();
  });

  server.on('resumeSession', (id, cb: (foo: Error | null, bar: Buffer | null) => void) => {
    cb(null, tlsSessionStore.get(id.toString('hex')) || null);
  });

  server.on('OCSPRequest', (cert, issuer) => {
    // why thru me tho
  });
  */

  server.on('secureConnection', (socket) => {
    sendMessage(wrkID, 'TLS handshake completed');
  })

  server.on('request', async (req, res) => {
    sendMessage(wrkID, '', req);

    try {
      const paramIndex = req.url!.indexOf('?');
      switch (paramIndex === -1 ? req.url : req.url!.slice(0, paramIndex)) {
        // auth
        case '/auth/local/login': await login.handle(req, res, clientPg); break;
        case '/auth/local/register': await register.handle(req, res, clientPg); break;

        // api
        case '/api/secret': await secret.handle(req, res, clientPg, clientRedis); break;
        case '/api/add/folder': await folder.handle(req, res, clientPg, clientRedis); break;

        // ROOT
        case '/':
          res.statusCode = 200;
          res.end('root');
          break;
        default: handle404(res);
      }
    } catch(err: any) {
      handle500(res, err);
    }
  });

  server.on('close', () => {
    sendMessage(wrkID, 'Server closed');
  });

  server.on('listening', () => {
    sendMessage(wrkID, `Worker ${wrkID} listening on port: ${listenOptions.port}`);
  });

  server.listen(listenOptions);
}
