import { handle302, handle400, handle405 } from '../../services/error';
import verifySession from '../../services/session';

import type { IncomingMessage, ServerResponse } from 'http';
import type { Client } from 'pg';
import type { Post } from '../../types.d';

const SUB_POST_LIMIT = Number(process.env._SUB_POST_LIMIT) || 50;
const PAGE_POST_LIMIT = Number(process.env._PAGE_POST_LIMIT) || 10;

async function handleGET(req: IncomingMessage, res: ServerResponse, clientPG: Client, userid: string): Promise<void> {
  try {
    const params = new URL(req.url || '/', 'https://localhost').searchParams;
    var opts = {
      folder: params.get('folder') || undefined,
      sort: params.get('sort') || 'date_desc',
      read: params.get('read') === 'true' ? true : false,
      star: params.get('star') === 'true' ? true : false,
      pagenum: Number(params.get('pagenum')) || 1,
    };
    if (!opts.folder) throw new Error();
  } catch(e: any) {
    return handle400(res, 'Request params could not be parsed');
  }

  // throw error if folder does not exist
  const folderid: string | undefined = await clientPG.query(`SELECT folderid FROM folder WHERE userid = '${userid}' AND name = '${opts.folder}'`)
    .then(r => r.rows[0] ? r.rows[0].folderid : undefined);
  if (!folderid) return handle400(res, 'Folder does not exist');

  // for each subscription fetch the posts
  /* do not return:
    * more than POST_LIMIT posts per subscription
    * posts that are 1yr older than the subscriptions refresh_date
  */
  const subs: string[] = await clientPG.query(`SELECT sub.name FROM folder INNER JOIN subscription sub ON folder.folderid = sub.folderid WHERE folder.folderid = '${folderid}'`)
    .then(r => r.rows.map(entry => entry.name));

  let posts: Post[] = [];
  for (let sub of subs) {
    const query = `SELECT post.title, post.date, post.content, post.author, post.url, post.image_title, post.image_url, status.read, status.star \
\ \ \ \ FROM subscription sub INNER JOIN post ON sub.feedid = post.feedid LEFT OUTER JOIN status ON post.postid = status.postid \ 
\ \ \ \ WHERE sub.name = '${sub}' \
\ \ \ \ AND post.date > sub.refresh_date + '-1 year' \
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

  res.statusCode = 200;

  // return max PAGE_POST_LIMIT posts per request
  const offset = (opts.pagenum - 1) * PAGE_POST_LIMIT;
  res.end(JSON.stringify(posts.slice(offset, opts.pagenum * PAGE_POST_LIMIT)));
}

export async function handle(req: IncomingMessage, res: ServerResponse, clientPG: Client): Promise<void> {
  res.strictContentLength = true;

  try {
    var userid = await verifySession(req, clientPG);
    if (!userid)
      return  handle302(res, `/auth/local/login`, req.url || '/');
  } catch(e: any) {
    return handle400(res, e.message);
  }

  switch (req.method) {
    case 'GET': handleGET(req, res, clientPG, userid); break;
    default: handle405(res);
  }
}
