import { IncomingMessage } from "node:http";

export interface Message {
  short: string,
  long: {
    id: number
    address?: string
    port?: number
    family?: string
    url?: IncomingMessage['url']
    method?: IncomingMessage['method']
    headers?: IncomingMessage['headers']
  }
}

export interface SystemError {
  address?: string,
  code: string,
  dest?: string,
  errno: number,
  info?: string,
  message: string,
  path?: string,
  port?: string,
  syscall: string,
}

export type Cookies = { [name?: string]: string }

export interface Post {
  title: string
  date: Date
  content: string
  author: string | null
  url: string | null
  image_title: string | null
  image_url: string | null
  read: boolean | null
  star: boolean | null
}

export interface FeedItem {
  title: string
  pubDate: Date
  description: string
  link: string
  origlink: string
  author: string
  image: {
    title: string
    url: string
  }
}

export interface NodeErrorConstructor extends ErrorConstructor {
  new (message?: string, options?: { cause: string }): Error;
  (message?: string, options?: { cause: string} ): Error;
}

// JWT
export type Algorithm = 'HS256' | 'HS384' | 'HS512';

export interface JWTHeader {
  typ: 'JWT'
  alg: Algorithm
}

export interface JWTPayload {
  iss?: string
  sub?: string
  aud?: string | string[]
  jti?: string
  nbf?: number
  exp?: number
  iat?: number
  [propName: string]: unknown
}

export interface JWTInput {
  header: string
  payload: string
  signature: string
}

// OAUTH
export interface AuthRequest {
  response_type: string
  client_id: string
  redirect_uri?: string
  scope?: string
  state?: string
}
