import * as pg from 'pg';
import * as redis from 'redis';
import HTTPClient from '76a01a3490137f87';

let CACHE_ENABLED = process.env._CACHE_ENABLED || true;

const configPg: pg.ClientConfig = Object.freeze({
  user: 'postgres',
  host: 'database',
  port: 6566,
  password: 'password',
});

export async function initPG(database: string): Promise<pg.Client> {
	const client = new pg.Client({ ...configPg, database });
	await client.connect();

  /*
	client.on('error', err => {
		console.error('postgres error', err.stack)
	});
	client.on('notice', msg => console.warn('notice:', msg));
  */

	return client;
}

export async function initRedis() {
  const configRedis: redis.RedisClientOptions<redis.RedisModules, redis.RedisFunctions, redis.RedisScripts> = Object.freeze({
    socket: {
      host: 'cache',
      port: 6567,
      family: 4,
      //keepAlive: 5000,
      reconnectStrategy: (retries: number) => { 
        if (retries > 6)
          return new Error('Connection timed out');

        return retries*500;
      },
    },
    readonly: false,
  });

  const client = await redis.createClient(configRedis).connect();

  client.on('ready', () => {
    console.log('Redis client ready; caching enabled');
    CACHE_ENABLED = true;
  });
  client.on('error', (err) => {
    console.error('Redis client error; caching disabled');
    CACHE_ENABLED = false;
  });
  client.on('reconnecting', () => {
    console.error('Redis client attempting to reconnect; caching disabled');
    CACHE_ENABLED = false;
  });
  client.on('end', () => {
    console.error('Redis client exited; caching disabled');
    CACHE_ENABLED = false;
  });

  return client;
}

export async function initHTTPClient(): Promise<HTTPClient> {
  const client = new HTTPClient({ debug: 0, pgOptions: { ...configPg, database: "http_client" }  });
  await client.bootup();

  return client;
}

export async function teardown(client: HTTPClient, clientPG: pg.Client, clientRedis: any) {
  client.teardown;
  clientPG.end();
  clientRedis.quit();
}

export async function createTables(client: pg.Client): Promise<undefined> {
  await client.query(`CREATE TABLE IF NOT EXISTS account (userid varchar(16) CONSTRAINT pk_userid PRIMARY KEY, username varchar(32), \
\ \ email varchar(64), password varchar(64), salt varchar(32))`);
  await client.query(`CREATE TABLE IF NOT EXISTS folder (folderid varchar(16) CONSTRAINT pk_folderid PRIMARY KEY, \
\ \ userid varchar(16) REFERENCES account(userid) ON DELETE CASCADE, name varchar(32))`);
  await client.query(`CREATE TABLE IF NOT EXISTS feed (feedid varchar(16) CONSTRAINT pk_feedid PRIMARY KEY, \
\ \ url bpchar, count smallint)`);
  await client.query(`CREATE TABLE IF NOT EXISTS subscription (subid varchar(16) CONSTRAINT pk_subid PRIMARY KEY, \
\ \ folderid varchar(16) REFERENCES folder(folderid) ON DELETE CASCADE, feedid varchar(16) REFERENCES feed(feedid), name varchar(16), refresh_date timestamp(0) without time zone)`);
  await client.query(`CREATE TABLE IF NOT EXISTS post (postid varchar(16) CONSTRAINT pk_postid PRIMARY KEY, \
\ \ feedid varchar(16) REFERENCES feed(feedid) ON DELETE CASCADE, title varchar(64) NOT NULL, date timestamp NOT NULL, url bpchar NOT NULL, \
\ \ content text, author varchar(64), image_title varchar(64), image_url bpchar)`);
  await client.query(`CREATE TABLE IF NOT EXISTS status (userid varchar(16) REFERENCES account(userid) ON DELETE CASCADE, \
\ \ postid varchar(16) REFERENCES post(postid) ON DELETE CASCADE, star boolean, read boolean)`);
}

export async function dropTables(client: pg.Client): Promise<undefined> {
  await client.query(`DROP TABLE account, folder, feed, subscription, post, status CASCADE`);
}
