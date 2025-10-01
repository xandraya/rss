import { hash } from 'node:crypto';
import * as _cluster from 'node:cluster';
const cluster = _cluster as unknown as _cluster.Cluster;
import FeedParser from 'feedparser';
import { handle302, handle400, handle405 } from '../services/error';
import verifySession from '../services/session';

import type { IncomingMessage, ServerResponse } from 'http';
import type { Client } from 'pg';
import type HTTPClient from 'http_client';
import type { FeedItem } from '../types';

// setup custom limits for the testing endpoint
const AGE_POST_LIMIT = cluster.worker && cluster.worker!.id !== Number(process.env._WORKER_COUNT)+1 ? process.env._AGE_POST_LIMIT! : '1 year';
const SUB_POST_LIMIT = cluster.worker && cluster.worker!.id !== Number(process.env._WORKER_COUNT)+1 ? Number(process.env._SUB_POST_LIMIT) : 3;

export async function fetchPosts(url: URL, client: HTTPClient): Promise<FeedItem[]> {
  return new Promise((resolve, reject) => {
    const optsFP = Object.freeze({
      normalize: true,
      addmeta: true,
      feedurl: url.origin,
      resume_saxerror: true,
    });
    const optsReq = Object.freeze({
      host: url.hostname,
      path: url.pathname,
      port: url.port,
      method: 'GET',
      protocol: url.protocol.slice(0,-1),
    });

    let items: FeedItem[] = [];
    const feedparser = new FeedParser(optsFP);
    feedparser
      .on('error', reject)
      .on('end', () => resolve(items))
      .on('readable', async function (this: typeof FeedParser) {
        let item: FeedItem;
        // @ts-ignore
        while ((item = this.read())) {
          items.push(item);
        }
      });

    const cb = (chunk: Buffer) => feedparser.write(chunk);
    client.request(optsReq, cb).then(() => feedparser.end());
  });
}

async function handlePOST(req: IncomingMessage, res: ServerResponse, client: HTTPClient, clientPG: Client, clientRD: any, userid: string): Promise<void> {
  {
    req.setEncoding('utf8')
    let data: string = '';
    for await (const chunk of req) data += chunk;
    try {
      var opts = JSON.parse(data);
      if (!opts.folder) throw new Error();
    } catch(e: any) {
      return handle400(res, 'Request params could not be parsed');
    }
  }

  // throw error if folder does not exist
  const folderid: string | undefined = await clientPG.query(`SELECT folderid FROM folder WHERE userid = '${userid}' AND name = '${opts.folder}'`)
    .then(r => r.rows[0] ? r.rows[0].folderid : undefined);
  if (!folderid)
    return handle400(res, 'Folder does not exist');

  const feeds: { feedid: string, url: string}[] = await clientPG.query(`SELECT feed.feedid, feed.url FROM folder INNER JOIN subscription sub ON folder.folderid = sub.folderid \
\ \ \ INNER JOIN feed ON sub.feedid = feed.feedid WHERE folder.folderid = '${folderid}'`).then(r => r.rows);

  // fetch and add posts to the database
  {
    for (let i=0; i<feeds.length; i++) {
      const url = new URL(feeds[i].url);
      let postid: string;
      for (let post of await fetchPosts(url, client)) {
        post.image.title = post.image.title || '';

        // generate id
        postid = hash('sha256', `${feeds[i].feedid}${post.origlink || post.link}`, 'hex').slice(0,16);

        // validate length
        post.title = post.title.length > 64 ? post.title.slice(0,61)+'...' : post.title;
        post.author = post.author.length > 64 ? post.author.slice(0,61)+'...' : post.author;
        post.image.title = post.image.title.length > 64 ? post.image.title.slice(0,61)+'...' : post.image.title;

        // validate data
        post.title = post.title.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
        post.description = post.description.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
        post.author = post.author.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
        post.image.title = post.image.title.replaceAll("\\", "\\\\").replaceAll("'", "\\'");

        // skip adding if post already exists
        if (await clientPG.query(`SELECT title FROM post WHERE postid = '${postid}'`).then(r => r.rows.length === 0))
          await clientPG.query(`INSERT INTO post (postid, feedid, title, date, content, url, author, image_title, image_url) VALUES \
\ \ \ \ \ ('${postid}', '${feeds[i].feedid}', E'${post.title}', '${post.pubDate.toUTCString()}', E'${post.description}', '${post.origlink || post.link}', \
\ \ \ \ \ E'${post.author}', E'${post.image.title}', '${post.image.url}')`);
      }
    }
  }
  
  // update all sub refresh_dates
  {
    const date = (new Date()).toUTCString();
    await clientPG.query(`UPDATE subscription SET refresh_date = '${date}' WHERE subid IN \
\ \ \ (SELECT sub.subid FROM subscription sub INNER JOIN folder ON sub.folderid = folder.folderid WHERE folder.folderid = '${folderid}') `);
  }
  
  /* remove posts:
    * that are AGE_POST_LIMIT older than the oldest sub refresh_date
    * if theres more than SUB_POST_LIMIT of them above the oldest sub refresh_date
    * dont remove starred posts
  */
  if (feeds.length) {
    // create a view of all posts that are older than the oldest subscriptions refresh_date
    // don't include starred posts
    await clientPG.query(`\
\ \ \ CREATE OR REPLACE TEMP VIEW cleanup AS (\
\ \ \ \ WITH oldest AS \
\ \ \ \ \ (SELECT feed.feedid, MIN(sub.refresh_date) refresh_date FROM feed INNER JOIN subscription sub ON feed.feedid = sub.feedid GROUP BY feed.feedid) \
\ \ \ \ SELECT oldest.feedid, oldest.refresh_date, post.postid, post.date FROM oldest INNER JOIN post ON oldest.feedid = post.feedid \
\ \ \ \ WHERE post.date <= oldest.refresh_date AND post.postid NOT IN (SELECT postid FROM status))`) 

    for (let i=0; i<feeds.length; i++) {
      // AGE_POST_LIMIT
      await clientPG.query(`DELETE FROM post WHERE post.date < (SELECT refresh_date FROM cleanup WHERE postid = post.postid) + '-${AGE_POST_LIMIT}' AND feedid = '${feeds[i].feedid}'`);

      // SUB_POST_LIMIT
      await clientPG.query(`WITH batch AS \
\ \ \ \ (SELECT postid FROM (SELECT ROW_NUMBER() OVER (ORDER BY date DESC) as row_num, postid FROM cleanup WHERE feedid = '${feeds[i].feedid}') WHERE row_num > ${SUB_POST_LIMIT}) \
\ \ \ \ DELETE FROM post USING batch WHERE batch.postid = post.postid`);
    }
  }
  
  // dump cache
  await clientRD.del(`${userid}:${folderid}`);

  res.statusCode = 201;
  res.end();
}

export async function handle(req: IncomingMessage, res: ServerResponse, client: HTTPClient, clientPG: Client, clientRD: any): Promise<void> {
  res.strictContentLength = true;

  try {
    var userid = await verifySession(req, clientPG);
    if (!userid)
      return handle302(res, `/auth/local/login`, req.url || '/');
  } catch(e: any) {
    return handle400(res, e.message);
  }

  switch (req.method) {
    case 'POST': handlePOST(req, res, client, clientPG, clientRD, userid); break;
    default: handle405(res);
  }
}
