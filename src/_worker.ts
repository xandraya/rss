import * as util from 'node:util';
import * as wt from 'node:worker_threads';

//import initServer from './server';

const WORKER_COUNT = process.env._WORKER_COUNT ? Number(process.env._WORKER_COUNT) : require('node:os').availableParallelism() as number;

if (wt.isMainThread) {
  module.exports = function initWorkers() {
    for (let i=0; i<WORKER_COUNT; i++) {
      const channel = new wt.MessageChannel();
      const worker = new wt.Worker(__filename, {
        workerData: { id: i, port: channel.port2 },
        transferList: [channel.port2],
        trackUnmanagedFds: true,
        stdout: false,
        stderr: false,
        name: `wrk${i}`,
      })

      channel.port1.on('message', msg => {
        console.log();
        console.log(`Message from wrk${i}`);
        console.log(util.inspect(msg));
      });
    }
  }
} else {
  const port = wt.workerData.port as wt.MessagePort;

  port.postMessage('foobar');
}
