require('dotenv').config();

import * as fs from 'node:fs';
import * as _cluster from 'node:cluster';
const cluster = _cluster as unknown as _cluster.Cluster;
import initServer from './server';

import type { Message } from './types.d';

const CLUSTER_COUNT = process.env._WORKER_COUNT ? Number(process.env._WORKER_COUNT) : require('node:os').availableParallelism() as number;
const encoder = new TextEncoder();

if (cluster.isPrimary) {
  cluster.setupPrimary({
    exec: './src/index.ts',
  })

  fs.mkdir('./logs', { recursive: true }, (err) => {
    if (err) throw new Error('MKDIR FAILED');

    for (let i=0; i<CLUSTER_COUNT; i++) {

      const fd = fs.openSync(`./logs/wrk${i+1}.log`, 'w');
      const worker = cluster.fork();

      worker.on('message', (msg: Message) => {
        console.log(msg.short);
        if (process.env._DEBUG && Object.keys(msg.long).length > 1)
          fs.writeSync(fd, encoder.encode(JSON.stringify(msg.long)));
      });

      worker.on('disconnect', () => {
        fs.closeSync(fd);
      });

      worker.on('exit', (code, signal) => {
        if (signal) {
          console.log(`Worker was killed by signal: ${signal}`);
        }
        else if (code !== 0)
          console.log(`Worker exited with error code: ${code}`);
        else {
          console.log('Worker success!');
        }
      });
    }
  });
} else {
  if (cluster.worker && cluster.worker.id) initServer(cluster.worker.id);
}
