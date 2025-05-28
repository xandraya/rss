import { handle405 } from '../../services/error';

import type { IncomingMessage, ServerResponse } from 'http';

function handleGET(res: ServerResponse): void {
  const html = `
  <html>
    <head>
      <link rel="alternate" type='application/rss+xml' title="rss" href="/feed.rss" /> 
      <link rel="alternate" type='application/atom+xml' title="atom" href="/feed.atom" /> 
    </head>
    <body></body>
  </html>
  `

  res.statusCode = 200;
  res.end(html);
}

export async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.strictContentLength = true;

  switch (req.method) {
    case 'GET': handleGET(res); break;
    default: handle405(res);
  }
}
