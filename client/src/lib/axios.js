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
  // In development: '/api' — Vite's proxy forwards to http://localhost:3001.
  // In production: VITE_API_URL points directly to the Render server URL.
  baseURL: import.meta.env.VITE_API_URL ?? '/api',

  // withCredentials: true tells the browser to include cookies
  // on every request, even during development when the frontend (port 5173)
  // and backend (port 3001) are on different ports.
  // Without this, the JWT cookie is never sent and every protected
  // route returns 401.
  withCredentials: true,
})

// ---------------------------------------------------------------------------
// No CSRF token header needed.
// ---------------------------------------------------------------------------
// The server now uses Origin-header verification instead of the cookie
// double-submit pattern. The browser sets the Origin header automatically
// on every cross-origin request, so no client-side work is required.

export default api
