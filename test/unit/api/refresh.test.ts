import { fetchPosts } from '../../../src/api/refresh';
import { initHTTPClient, initPG } from '../../services/db';

import type { Client } from 'pg';
import type HTTPClient from '76a01a3490137f87';

let client: HTTPClient
let clientPG: Client;

beforeAll(async () => {
  clientPG = await initPG('test');
  client = await initHTTPClient();
  await client.bootup();
});

describe('fetchPosts', () => {
  test('Successfully fetches and parses valid RSS/ATOM syntax', async () => {
    const url = new URL('https://app:8082/api/blob/unit_refresh.xml');
    let posts = await fetchPosts(url, client);

    expect(posts.length).toBe(4);
    expect(posts[0].title).toBe('Star City');
    expect(posts[1].title).toBe(null);
    expect(posts[2].title).toBe('The Engine That Does More');
    expect(posts[3].title).toBe('Astronauts\' Dirty Laundry');
  });
});

afterAll(async () => {
  await clientPG.end();
  await client.teardown();
});
