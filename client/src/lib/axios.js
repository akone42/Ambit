/**
 * CONFIGURED AXIOS INSTANCE
 *
 * We create one instance with our settings baked in.
 * Every file that needs to call the API imports `api` from here —
 * never imports axios directly.
 *
 * Why not just use fetch()?
 * Axios gives us:
 *   - Automatic JSON parsing (fetch requires a manual .json() call)
 *   - Request/response interceptors (we use one for CSRF below)
 *   - Consistent error objects (fetch only rejects on network failure,
 *     not on 4xx/5xx — Axios rejects on both)
 */

import axios from 'axios'

const api = axios.create({
  // baseURL: every request made with this instance prepends this.
  // So api.get('/auth/me') becomes a request to /api/auth/me.
  // Vite's proxy (vite.config.js) forwards /api/* to http://localhost:3001.
  baseURL: '/api',

  // withCredentials: true tells the browser to include cookies
  // on every request, even during development when the frontend (port 5173)
  // and backend (port 3001) are on different ports.
  // Without this, the JWT cookie is never sent and every protected
  // route returns 401.
  withCredentials: true,
})

// ---------------------------------------------------------------------------
// REQUEST INTERCEPTOR — attach CSRF token
// ---------------------------------------------------------------------------
// An interceptor is a function that runs automatically before every request.
// This one reads the csrf_token cookie (set by the server, readable by JS)
// and adds it as the X-CSRF-Token header.
//
// Why do we need to do this manually?
// The browser sends cookies automatically, but custom headers must be set
// explicitly. The server's verifyCsrf middleware checks for this header,
// so without it every POST/PUT/DELETE would return 403.
api.interceptors.request.use((config) => {
  // Read the csrf_token cookie.
  // document.cookie is a single string of all cookies:
  //   "csrf_token=abc123; other_cookie=xyz"
  // We split by '; ', find the right one, then split by '=' to get the value.
  const csrfToken = document.cookie
    .split('; ')
    .find((row) => row.startsWith('csrf_token='))
    ?.split('=')[1]

  if (csrfToken) {
    config.headers['x-csrf-token'] = csrfToken
  }

  return config
})

export default api
