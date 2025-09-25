import * as pg from 'pg';
import * as redis from 'redis';
import HTTPClient from '76a01a3490137f87';

// shared pg config
const config: pg.ClientConfig = Object.freeze({
  user: 'postgres',
  host: 'database',
  port: 6566,
  password: 'password',
});

export async function initHTTPClient(): Promise<HTTPClient> {
  const client = new HTTPClient({ debug: Number(process.env._DEBUG) ? 1 : 0, pgOptions: { ...config, database: "http_client" }  });
  await client.bootup();

  return client;
}

export async function initPG(db: string): Promise<pg.Client> {
	const client = new pg.Client({ ...config, database: db });
	await client.connect();

  if (Number(process.env._DEBUG)) {
    client.on('error', err => {
      console.error('postgres error', err.stack)
    });
    client.on('notice', msg => console.warn('notice:', msg));
  }

	return client;
}

export async function initRD(db: number) {
  const configRedis: redis.RedisClientOptions<redis.RedisModules, redis.RedisFunctions, redis.RedisScripts> = Object.freeze({
    database: db,
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

  if (Number(process.env._DEBUG)) {
    client.on('ready', () => {
      console.log('Redis client ready; caching enabled');
    });
    client.on('error', () => {
      console.error('Redis client error; caching disabled');
      process.env._CACHING = '0';
    });
    client.on('reconnecting', () => {
      console.warn('Redis client attempting to reconnect; caching disabled');
      process.env._CACHING = '0';
    });
    client.on('end', () => {
      console.warn('Redis client exited; caching disabled');
      process.env._CACHING = '0';
    });
  }

  return client;
}

export async function createTables(client: pg.Client): Promise<undefined> {
  await client.query(`CREATE TABLE IF NOT EXISTS account (userid varchar(16) CONSTRAINT pk_userid PRIMARY KEY, username varchar(32) NOT NULL, \
\ \ email varchar(64) NOT NULL, password varchar(64) NOT NULL, salt varchar(32) NOT NULL)`);
  await client.query(`CREATE TABLE IF NOT EXISTS folder (folderid varchar(16) CONSTRAINT pk_folderid PRIMARY KEY, \
\ \ userid varchar(16) REFERENCES account(userid) ON DELETE CASCADE NOT NULL, name varchar(32) NOT NULL)`);
  await client.query(`CREATE TABLE IF NOT EXISTS feed (feedid varchar(16) CONSTRAINT pk_feedid PRIMARY KEY, \
\ \ url bpchar NOT NULL, count smallint NOT NULL)`);
  await client.query(`CREATE TABLE IF NOT EXISTS subscription (subid varchar(16) CONSTRAINT pk_subid PRIMARY KEY, \
\ \ folderid varchar(16) REFERENCES folder(folderid) ON DELETE CASCADE NOT NULL, feedid varchar(16) REFERENCES feed(feedid) NOT NULL, \
\ \ name varchar(32) NOT NULL, refresh_date timestamp(0) without time zone NOT NULL)`);
  await client.query(`CREATE TABLE IF NOT EXISTS post (postid varchar(16) CONSTRAINT pk_postid PRIMARY KEY, \
\ \ feedid varchar(16) REFERENCES feed(feedid) ON DELETE CASCADE NOT NULL, title varchar(64) NOT NULL, date timestamp(0) without time zone NOT NULL, url bpchar NOT NULL, \
\ \ content text, author varchar(64), image_title varchar(64), image_url bpchar)`);
  await client.query(`CREATE TABLE IF NOT EXISTS status (userid varchar(16) REFERENCES account(userid) ON DELETE CASCADE NOT NULL, \
\ \ postid varchar(16) REFERENCES post(postid) ON DELETE CASCADE NOT NULL, star boolean, read boolean, CONSTRAINT pk_status PRIMARY KEY (userid, postid))`);
}

export async function dropTables(client: pg.Client): Promise<undefined> {
  await client.query(`DROP TABLE IF EXISTS account, folder, feed, subscription, post, status CASCADE`);
}
