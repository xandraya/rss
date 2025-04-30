import { handle405 } from '../../services/error.ts';

import type * as http from 'node:http';
import type * as pg from 'pg';

export async function handle(req: http.IncomingMessage, res: http.ServerResponse, client: pg.Client): Promise<number> {
  res.strictContentLength = true;

  switch (req.method) {
    case 'GET': break;
    default: handle405(res);
  }

  return 0;
}
