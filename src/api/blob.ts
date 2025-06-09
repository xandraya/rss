import { handle400, handle405 } from '../services/error';
import * as fs from 'node:fs';

import type { IncomingMessage, ServerResponse } from 'http';

function handleGET(res: ServerResponse, blob: string): void {
  fs.readFile(`./data/${blob}`, (err, data) => {
    if (err) handle400(res, 'Missing blob');
    res.statusCode = 200;
    res.end(data);
  });
}

export async function handle(req: IncomingMessage, res: ServerResponse, blob: string): Promise<void> {
  res.strictContentLength = true;

  switch (req.method) {
    case 'GET': handleGET(res, blob); break;
    default: handle405(res);
  }
}
