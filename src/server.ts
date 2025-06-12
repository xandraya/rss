import * as https from 'node:https';
import * as fs from 'node:fs';

import * as db from './services/db';
import { sendMessage } from './services/misc';
import { handle404, handle500 } from './services/error';

import type { SystemError } from './types.d';
import type { Client } from 'pg';
import type HTTPClient from '76a01a3490137f87';

export default async function initServer(wrkID: number, CLUSTER_COUNT: number) {
  let client: HTTPClient;
  let clientPG: Client;
  let clientRedis: any;
  if (!process.env._JWT_KEY) throw new Error('JWT Key not initialized');

  //const tlsSessionStore = new Map<string, Buffer>();
  if (wrkID !== CLUSTER_COUNT+2) {
    clientPG = wrkID === CLUSTER_COUNT+1 ? await db.initPG('test') : await db.initPG('server');
    clientRedis = await db.initRedis();
    client = await db.initHTTPClient();
    //await db.dropTables(clientPG);
    await db.createTables(clientPG);
  }

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
    port: wrkID === CLUSTER_COUNT+1 ? 8081 :
      wrkID === CLUSTER_COUNT+2 ? 8082 : 8080,
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
        db.teardown(client, clientPG, clientRedis);
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
      if (wrkID === CLUSTER_COUNT+2) {
        // testing endpoints
        switch (paramIndex === -1 ? req.url : req.url!.slice(0, paramIndex)) {
          case '/api/blob/unit_refresh.xml': await (require('./api/blob')).handle(req, res, 'unit_refresh.xml'); break;
          case '/api/blob/func_scrape.html': await (require('./api/blob')).handle(req, res, 'func_scrape.html'); break;
          case '/api/blob/func_refresh.xml': await (require('./api/blob')).handle(req, res, 'func_refresh.xml'); break;

          // ROOT
          case '/':
            res.statusCode = 200;
            res.end('root');
            break;
          default: handle404(res);
        }
      } else {
        // default endpoints
        switch (paramIndex === -1 ? req.url : req.url!.slice(0, paramIndex)) {
          // auth
          case '/auth/local/login': await (require('./auth/local/login')).handle(req, res, clientPG); break;
          case '/auth/local/register': await (require('./auth/local/register')).handle(req, res, clientPG); break;

          // api
          case '/api/secret': await (require('./api/secret')).handle(req, res, clientPG, clientRedis); break;
          case '/api/scrape': await (require('./api/scrape')).handle(req, res, client, clientPG); break;
          case '/api/add/folder': await (require('./api/add/folder')).handle(req, res, clientPG); break;
          case '/api/add/sub': await (require('./api/add/sub')).handle(req, res, clientPG); break;
          case '/api/refresh': await (require('./api/refresh')).handle(req, res, client, clientPG); break;
          case '/api/fetch/folder': await (require('./api/fetch/folder')).handle(req, res, clientPG); break;

          // ROOT
          case '/':
            res.statusCode = 200;
            res.end('root');
            break;
          default: handle404(res);
        }
      }
    } catch(err: any) {
      handle500(res, err);
    }
  });

  server.on('close', () => {
    db.teardown(client, clientPG, clientRedis);
    sendMessage(wrkID, 'Server closed');
  });

  server.on('listening', () => {
    sendMessage(wrkID, `Worker ${wrkID} listening on port: ${listenOptions.port}`);
  });

  server.listen(listenOptions);
}
