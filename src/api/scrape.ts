import { handle302, handle400, handle405 } from '../services/error';
import verifySession from '../services/session';

import type { IncomingMessage, ServerResponse } from 'http';
import type { Client } from 'pg';
import type HTTPClient from '76a01a3490137f87';

export async function fetchHtml(url: URL, client: HTTPClient): Promise<string> {
  let data = '';
  let cb = (chunk: Buffer) => data += chunk;
  const reqOpts = {
    host: url.hostname,
    path: url.pathname,
    port: url.port,
    method: 'GET',
  }

  await client.request(reqOpts, cb);
  return data;
}

export function parseFeeds(url: URL, html: string): Array<{ title?: string; href: string }> {
  const feedPattern = /<link[^>]+rel=["']alternate["'][^>]+type=["'](application\/(rss|atom)\+xml)["'][^>]*>/gi;
  const attributePattern = /(\w+)\s*=\s*(?:"([^"]*)"|'([^"']*)')/g;
  const feeds: Array<{ title?: string; href: string }> = [];

  let match: RegExpExecArray | null;
  while ((match = feedPattern.exec(html)) !== null) {
    const attributes: Record<string, string> = {};
    let attrMatch: RegExpExecArray | null;

    while ((attrMatch = attributePattern.exec(match[0])) !== null)
      attributes[attrMatch[1].toLowerCase()] = attrMatch[2];
    attributePattern.lastIndex = 0;

    if (attributes.href) {
      try {
        feeds.push({
          title: attributes.title,
          href: new URL(attributes.href, url).toString()
        });
      } catch {
        // Invalid URLs skipped
      }
    }
  }
  return feeds;
}

async function handleGET(req: IncomingMessage, res: ServerResponse, client: HTTPClient): Promise<void> {
  let url = new URL(`http://localhost${req.url}`);
  const site = url.searchParams.get('site');
  if (!site) return handle400(res, 'Feed host URL not supplied');
  try {
    url = new URL(site);
  } catch(e) {
    return handle400(res, 'Feed host URL malformed');
  }

  const html = await fetchHtml(url, client);
  const feeds = parseFeeds(url, html);
  res.statusCode = 200;
  res.setHeader('Content', 'application/json')
    .end(JSON.stringify(feeds))
}

export async function handle(req: IncomingMessage, res: ServerResponse, client: HTTPClient, clientPg: Client): Promise<void> {
  res.strictContentLength = true;

  try {
    const userid = await verifySession(req, clientPg);
    if (!userid)
      return handle302(res, `/auth/local/login`, req.url || '/');
  } catch(e: any) {
    return handle400(res, e.message);
  }

  switch (req.method) {
    case 'GET': handleGET(req, res, client); break;
    default: handle405(res);
  }
}
