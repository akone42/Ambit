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
// CSRF TOKEN — stored in memory
// ---------------------------------------------------------------------------
// In production the frontend (Vercel) and backend (Render) are on different
// domains. Browsers scope cookies to the domain that set them, so
// document.cookie on ambit-client.vercel.app cannot see cookies set by
// ambit-karx.onrender.com. Instead we fetch the token from a dedicated
// endpoint and keep it in a module-level variable.
let _csrfToken = null

/**
 * fetchCsrfToken
 *
 * Calls GET /csrf-token, which triggers setCsrfCookie on the server and
 * returns the token value in the response body.
 * Call this once on app startup (see App.jsx useEffect).
 */
export async function fetchCsrfToken() {
  const res = await api.get('/csrf-token')
  _csrfToken = res.data.csrfToken
}

// ---------------------------------------------------------------------------
// REQUEST INTERCEPTOR — attach CSRF token
// ---------------------------------------------------------------------------
// An interceptor is a function that runs automatically before every request.
// It attaches the in-memory CSRF token as the X-CSRF-Token header so the
// server's verifyCsrf middleware accepts POST/PUT/DELETE requests.
api.interceptors.request.use((config) => {
  if (_csrfToken) {
    config.headers['x-csrf-token'] = _csrfToken
  }
  return config
})

export default api
