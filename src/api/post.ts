import { handle302, handle400, handle405 } from '../services/error';
import verifySession from '../services/session';
import { CACHE_ENABLED } from '../services/db';

import type { IncomingMessage, ServerResponse } from 'http';
import type { Client } from 'pg';
import type { Post } from '../types';

const SUB_POST_LIMIT = Number(process.env._SUB_POST_LIMIT) || 50;
const PAGE_POST_LIMIT = Number(process.env._PAGE_POST_LIMIT) || 10;

async function handleGET(req: IncomingMessage, res: ServerResponse, clientPG: Client, clientRD: any, userid: string): Promise<void> {
  let superkey: string, key: string;

  try {
    const params = new URL(req.url || '/', 'https://localhost').searchParams;
    var opts = {
      folder: params.get('folder') || undefined,
      sort: params.get('sort') || 'date_desc',
      read: params.get('read') === 'true' ? true : false,
      star: params.get('star') === 'true' ? true : false,
      page: Number(params.get('page')) || 1,
    };
    if (!opts.folder) throw new Error();
  } catch(e: any) {
    return handle400(res, 'Request params could not be parsed');
  }

  // throw error if folder does not exist
  const folderid: string | undefined = await clientPG.query(`SELECT folderid FROM folder WHERE userid = '${userid}' AND name = '${opts.folder}'`)
    .then(r => r.rows[0] ? r.rows[0].folderid : undefined);
  if (!folderid) return handle400(res, 'Folder does not exist');

  // first attempt fetching from cache
  if (CACHE_ENABLED) {
    // create redis key
    superkey = `${userid}.${folderid}`;
    key = '';
    switch (opts.sort) {
      case 'alpha_asc': key += '1000'; break;
      case 'alpha_desc': key += '0100'; break;
      case 'date_asc': key += '0010'; break;
      case 'date_desc': key += '0001'; break;
    }
    opts.read ? key += '1' : key += '0';
    opts.star ? key += '1' : key += '0';
    key += `:${opts.page}`;

    // return if data found in cache
    const cachedData: string = await clientRD.hGet(superkey, key);
    if (cachedData) {
      console.log('/post CACHE HIT');

      res.statusCode = 200;
      res.end(cachedData);
      return;
    }
  }
  console.log('/post CACHE MISS');

  // for each subscription fetch the posts
  const subs: string[] = await clientPG.query(`SELECT sub.name FROM folder INNER JOIN subscription sub ON folder.folderid = sub.folderid WHERE folder.folderid = '${folderid}'`)
    .then(r => r.rows.map(entry => entry.name));

  let posts: Post[] = [];
  for (let sub of subs) {
    const query = `SELECT post.title, post.date, post.content, post.author, post.url, post.image_title, post.image_url, status.read, status.star \
\ \ \ \ FROM subscription sub INNER JOIN post ON sub.feedid = post.feedid LEFT OUTER JOIN status ON post.postid = status.postid \ 
\ \ \ \ WHERE sub.name = '${sub}' \
\ \ \ \ AND post.date > sub.refresh_date + '-1 year' \
\ \ \ \ AND post.date < sub.refresh_date \
\ \ \ \ ${opts.read ? 'AND status.read' : ''} \
\ \ \ \ ${opts.star ? 'AND status.star' : ''} \
\ \ \ \ LIMIT ${SUB_POST_LIMIT}`;
    posts = posts.concat(
      await clientPG.query(query).then(r => r.rows.map(entry => {
        entry.date = new Date(entry.date);
        return entry;
      }))
    );
  }

  switch(opts.sort) {
    case 'alpha_asc':
      posts.sort((a, b) => { 
        let A = a.title.toLowerCase();
        let B = b.title.toLowerCase();
        return A < B ? -1 : A === B ? 0 : 1
      });
      break;
    case 'alpha_desc':
      posts.sort((a, b) => { 
        let A = a.title.toLowerCase();
        let B = b.title.toLowerCase();
        return A > B ? -1 : A === B ? 0 : 1
      });
      break;
    case 'date_asc':
      posts.sort((a, b) => a.date < b.date ? -1 : a.date === b.date ? 0 : 1);
      break;
    default:
    case 'date_desc':
      posts.sort((a, b) => a.date > b.date ? -1 : a.date === b.date ? 0 : 1);
      break;
  }

  if (CACHE_ENABLED) {
    for (let i=1; i<posts.length; i++) {
      // @ts-ignore
      key = key.slice(0, key.length-1);
      key += i;

      // @ts-ignore
      await clientRD.hSet(superkey, key, JSON.stringify(posts.slice((i-1)*PAGE_POST_LIMIT, i*PAGE_POST_LIMIT)));
    }
  }

  res.statusCode = 200;

  // return max PAGE_POST_LIMIT posts per request
  const offset = (opts.page - 1) * PAGE_POST_LIMIT;
  res.end(JSON.stringify(posts.slice(offset, opts.page * PAGE_POST_LIMIT)));
}

export async function handle(req: IncomingMessage, res: ServerResponse, clientPG: Client, clientRD: any): Promise<void> {
  res.strictContentLength = true;

  try {
    var userid = await verifySession(req, clientPG);
    if (!userid)
      return handle302(res, `/auth/local/login`, req.url || '/');
  } catch(e: any) {
    return handle400(res, e.message);
  }

  switch (req.method) {
    case 'GET': handleGET(req, res, clientPG, clientRD, userid); break;
    default: handle405(res);
  }
}
