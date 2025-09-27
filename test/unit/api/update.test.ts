import { fetchPosts } from '../../../src/api/update';
import { initHTTPClient } from '../../services/db';

import type HTTPClient from '76a01a3490137f87';

let CLIENT: HTTPClient

beforeAll(async () => {
  CLIENT = await initHTTPClient();
});

afterAll(async () => {
  await CLIENT.teardown();
});

describe('fetchPosts', () => {
  test('Successfully fetches and parses valid RSS/ATOM syntax', async () => {
    const url = new URL('https://app:8082/api/blob/unit_refresh.xml');
    let posts = await fetchPosts(url, CLIENT);

    expect(posts.length).toBe(4);
    expect(posts[0].title).toBe('Star City');
    expect(posts[1].title).toBe(null);
    expect(posts[2].title).toBe('The Engine That Does More');
    expect(posts[3].title).toBe('Astronauts\' Dirty Laundry');
  });
});
