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

	client.on('error', err => {
		console.error('postgres error', err.stack)
	});
	client.on('notice', msg => console.warn('notice:', msg));

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
  await client.query(`create table if not exists account (userid varchar(16) constraint pk_userid primary key, username varchar(32), \
\ \ email varchar(64), password varchar(64), salt varchar(32))`);
  await client.query(`create table if not exists folder (folderid varchar(16) constraint pk_folderid primary key, \
\ \ userid varchar(16) references account(userid) on delete cascade, name varchar(32))`);
  await client.query(`create table if not exists feed (feedid varchar(16) constraint pk_feedid primary key, \
\ \ url bpchar, count smallint)`);
  await client.query(`create table if not exists subscription (subid varchar(16) constraint pk_subid primary key, \
\ \ folderid varchar(16) references folder(folderid) on delete cascade, feedid varchar(16) references feed(feedid), name varchar(16), refresh_date timestamp(0) without time zone)`);
}

export async function dropTables(client: pg.Client): Promise<undefined> {
  await client.query(`drop table account, folder, feed, subscription`);
}
