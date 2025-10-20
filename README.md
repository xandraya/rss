# rss

Sample API for an rss/atom feed agregator.<br/>
Created with minimal libraries to practice backend dev concepts.

# Documentation:

## /auth/local

<details>
  <summary><strong>GET</strong> /login</summary>
    <br/>
    Authorizes user through HTTP Basic Auth, generates JWT token used as a session identifier, and sets it as the <em>_session</em> cookie. 
    On successful login, user is redirected to the previously visited page, whose URL is stored in the <em>_referer</em> cookie.<br/>
    <br/>
</details>

<details>
  <summary><strong>POST</strong> /register</summary>
    <br/>
    Validates the credentials and creates a new user.<br/>
    <br/>

  *Request params (application/x-www-form-urlencoded):*
  ```typescript
  type P = {
    username: string
    password: string
    email: string
  }
  ```
</details>

## /auth/oauth/google

<details>
  <summary><strong>GET</strong> /login</summary>
    <br/>
    Begins the OAuth 2.0 authorization code flow by redirecting user agent to the Google's authorization endpoint 
    with scopes <em>userinfo.email</em> and <em>userinfo.profile</em> selected. 
    Protection against CSRF attacks via a state token is utilized.<br/>
    <br/>
</details>

<details>
  <summary><strong>GET</strong> /callback</summary>
    <br/>
    This endpoint is only intended to be used as a part of OAuth 2.0 flow and not called by itself. 
    Finshes the flow by authenticating and requesting a grant from Google's auth server, verifying received scopes, 
    fetching the access token and user credentials, creating a JWT token and saving it to the _session cookie.
    <br/>
</details>

## /api/user

<details>
  <summary><strong>GET</strong> /</summary>
    <br/>
    <blockquote>Endpoint requires authentication.</blockquote>
    <br/>
    Fetches user account metadata.<br/>
    <br/>

  *Return value:*
  ```typescript
  type R = {
    userid: string
    username: string
    email: string
  }
  ```
</details>

<details>
  <summary><strong>DELETE</strong> /</summary>
    <br/>
    <blockquote>Endpoint requires authentication.</blockquote>
    <br/>
    Removes user together with own created folders and subscriptions.<br/>
    <br/>
</details>

<details>
  <summary><strong>GET</strong> /folders</summary>
    <br/>
    <blockquote>Endpoint requires authentication.</blockquote>
    <br/>
    Fetches all folder names that belong to the currently logged in user.<br/>
    <br/>

  *Return value:*
  ```typescript
  type R = string[]
  ```
</details>

## /api/update

<details>
  <summary><strong>POST</strong> /</summary>
    <br/>
    <blockquote>Endpoint requires authentication.</blockquote>
    <br/>
    Refreshes all subscriptions that belong to the supplied folder.
    This endpoint does not return anything, however internally it fetches new posts to the database, 
    performs removal of the outdated ones according to the global policy, 
    and updates each subscriptions latest refresh date. 
    Newer posts can be subsequently fetched with a <strong>GET</strong> request to the <em>api/post</em> endpoint.<br/>
    <br/>

  *Request params (application/json):*
  ```typescript
  type P = {
    folder: string
  }
  ```
</details>

## /api/scrape

<details>
  <summary><strong>GET</strong> /</summary>
    <br/>
    <blockquote>Endpoint requires authentication.</blockquote>
    <br/>
    Searches for any available RSS or ATOM feed on the supplied URL, and returns any that are found.
    <br/>

  *Return value:*
  ```typescript
  type R = string[]
  ```
</details>

## /api/sub

<details>
  <summary><strong>POST</strong> /</summary>
    <br/>
    <blockquote>Endpoint requires authentication.</blockquote>
    <br/>
    Creates a new subscription to the supplied feed and binds it to a given folder.<br/>
    <br/>

  *Request params (application/json):*
  ```typescript
  type P = {
    name: string
    folder: string
    url: string
  }
  ```
</details>

<details>
  <summary><strong>DELETE</strong> /</summary>
    <br/>
    <blockquote>Endpoint requires authentication.</blockquote>
    <br/>
    Removes a subscription.<br/>
    <br/>

  *Request params (application/x-www-form-urlencoded):*
  ```typescript
  type P = {
    name: string
    folder: string
  }
  ```
</details>

## /api/folder

<details>
  <summary><strong>POST</strong> /</summary>
    <br/>
    <blockquote>Endpoint requires authentication.</blockquote>
    <br/>
    Creates a new folder with a given name.<br/>
    <br/>

  *Request params (application/json):*
  ```typescript
  type P = {
    name: string
  }
  ```
</details>

<details>
  <summary><strong>DELETE</strong> /</summary>
    <br/>
    <blockquote>Endpoint requires authentication.</blockquote>
    <br/>
    Removes a folder and all subscription binded to it.<br/>
    <br/>

  *Request params (application/x-www-form-urlencoded):*
  ```typescript
  type P = {
    name: string
  }
  ```
</details>

## /api/post

<details>
  <summary><strong>GET</strong> /</summary>
    <br/>
    <blockquote>Endpoint requires authentication.</blockquote>
    <br/>
    Fetches posts that belong to all subscriptions binded to the supplied folder. 
    Due to the globally hardcoded limits, the only posts that are fetched are the ones that:<br/>
    - are not 1yr older than the oldest subscriptions refresh date<br/>
    - are within the post limit per subscription<br/>
    - have the optionally selected flag set<br/>
    <br/>

  *Request params (application/x-www-form-urlencoded):*
  ```typescript
  type P = {
    folder: string
    page: number = 1
    sort?: alpha_asc | alpha_desc | date_asc | date_desc
    read?: boolean
    star?: boolean
  }
  ```
</details>

<details>
  <summary><strong>POST</strong> /</summary>
    <br/>
    <blockquote>Endpoint requires authentication.</blockquote>
    <br/>
    Updates a flag for a given post. Due to implementation limits, posts can only be uniquely identified by their internal ID.<br/>
    <br/>

  *Request params (application/json):*
  ```typescript
  type P = {
    url: string
    read?: boolean
    star?: boolean
  }
  ```
</details>

# RFCs referenced:

* 5234 | Augmented BNF for Syntax Specifications: ABNF
* 6265 | HTTP State Management Mechanism
* 6749 | The OAuth 2.0 Authorization Framework
* 7515 | JSON Web Signature (JWS)
* 7519 | JSON Web Token (JWT)
* 7617 | The 'Basic' HTTP Authentication Scheme

(๑ᵔ⤙ᵔ๑)
