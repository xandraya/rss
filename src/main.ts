import * as fs from 'node:fs';
import * as _cluster from 'node:cluster';
const cluster = _cluster as unknown as _cluster.Cluster;
import initServer from './server';
import { encoder } from './services/misc';

import type { Message } from './types.d';

// validate environment
require('dotenv').config();
['_WORKER_COUNT', '_TESTING', '_AGE_POST_LIMIT', '_SUB_POST_LIMIT', '_PAGE_POST_LIMIT', '_JWT_KEY', '_OAUTH_CLIENT_ID', '_OAUTH_CLIENT_SECRET']
  .forEach(env => { if (process.env[env] === undefined) throw new Error(`${env} not initialized`) });
if (process.env._WORKER_COUNT! > require('node:os').availableParallelism())
  throw new Error('CPU thread count exceeded');
const interval = /^\s*([+-]?)\s*(?:(\d+)\s*(?:years?)*\s*)?(?:(\d+)\s*(months?|days?|hours?|minutes?|seconds?)\s*)*$/;
if (!process.env._AGE_POST_LIMIT!.match(interval))
  throw new Error('Invalid _AGE_POST_LIMIT interval syntax');

if (cluster.isPrimary) {
  cluster.setupPrimary({
    exec: './src/main.ts',
  })

  fs.mkdir('./logs', { recursive: true }, (err) => {
    if (err) throw new Error('MKDIR FAILED');

    // initializes extra workers for testing
    const wCount = Number(process.env._WORKER_COUNT);
    for (let i=0; i < (Number(process.env._TESTING) ? wCount+2 : wCount); i++) {
      const fd = fs.openSync(`./logs/wrk${i+1}.log`, 'w');
      const worker = cluster.fork();

      worker.on('message', (msg: Message) => {
        console.log(msg.short);
        if (Number(process.env._DEBUG) && Object.keys(msg.long).length > 1)
          fs.writeSync(fd, encoder.encode(JSON.stringify(msg.long)));
      });

      worker.on('disconnect', () => {
        fs.closeSync(fd);
      });

      worker.on('exit', (code, signal) => {
        if (signal)
          console.log(`Worker ${i} was killed by signal: ${signal}`);
        else if (code !== 0)
          console.log(`Worker ${i} exited with error code: ${code}`);
        else {
          console.log(`Worker ${i} success!`);
        }
      });
    }
  });
} else {
  if (cluster.worker && cluster.worker.id) 
    setTimeout((id) => initServer(id), cluster.worker.id*1000, cluster.worker.id);
}
