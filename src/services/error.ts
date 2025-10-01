import type { ServerResponse } from 'node:http';

function template(code: string, reason: string) {
  return `
    <html>
      <head>
        <style>
          body {
            background-color: black;
            color: white;
          }
        </style>
      </head>
      <body>
        <h1>${code}</h1>
        <p>${reason}</p>
      </body>
    </html>`
}

export function handle302(res: ServerResponse, url: string, referer?: string, data?: string,) {
  res.statusCode = 302;
  res.setHeader('Location', url)
    .appendHeader('Set-Cookie', `${referer ? '_referer="' + referer + '"; ' : ''}Path=/; SameSite=Strict`)
    .end(data);
}

export function handle307(res: ServerResponse, url: string, referer?: string, data?: string) {
  res.statusCode = 307;
  res.setHeader('Location', url)
    .appendHeader('Set-Cookie', `${referer ? '_referer="' + referer + '"; ' : ''}Path=/; SameSite=Strict`)
    .end(data);
}

export function handle400(res: ServerResponse, reason: string) {
  res.statusCode = 400;
  res.end(template('400 Bad Request', reason));
}

export function handle401(res: ServerResponse, auth: string) {
  res.statusCode = 401;
  res.setHeader('WWW-Authenticate', auth)
    .end();
}

export function handle403(res: ServerResponse, reason: string) {
  res.statusCode = 403;
  res.end(template('403 Forbidden', reason));
}

export function handle404(res: ServerResponse) {
  res.statusCode = 404;
  res.end(template('404 Not Found', 'Invalid URL'));
}

export function handle405(res: ServerResponse) {
  res.statusCode = 405;
  res.setHeader('Allow', 'GET')
    .end();
}

export function handle500(res: ServerResponse, reason: string) {
  res.statusCode = 500;
  console.error(reason);
  res.end(template('500 Internal Server Error', reason));
}

export function handle501(res: ServerResponse) {
  res.statusCode = 501;
  res.end();
}

export function handle503(res: ServerResponse, reason: string) {
  res.statusCode = 503;
  res.end(template('503 Temporary Unavailable', reason));
}
