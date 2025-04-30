import type * as http from 'node:http';

export function handle400(res: http.ServerResponse) {
  res.statusCode = 400;
  res.end();
}

export function handle401(res: http.ServerResponse, auth: string) {
  res.statusCode = 401;
  res.setHeader('WWW-Authenticate', auth)
    .end();
}

export function handle403(res: http.ServerResponse, reason: string) {
  res.statusCode = 403;
  res.end(`
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
        <h1>403 Forbidden</h1>
        <p>${reason}</p>
      </body>
    </html>
  `);
}

export function handle404(res: http.ServerResponse) {
  res.statusCode = 404;
  res.end();
}

export function handle405(res: http.ServerResponse) {
  res.statusCode = 405;
  res.setHeader('Allow', 'GET')
    .end();
}

export function handle500(res: http.ServerResponse) {
  res.statusCode = 500;
  res.end();
}

export function handle501(res: http.ServerResponse) {
  res.statusCode = 501;
  res.end();
}
