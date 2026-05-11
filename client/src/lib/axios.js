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
 *   - Request/response interceptors (we use one for auth below)
 *   - Consistent error objects (fetch only rejects on network failure,
 *     not on 4xx/5xx — Axios rejects on both)
 */

import axios from 'axios'

const TOKEN_KEY = 'ambit_token'

/**
 * Persist and retrieve the JWT so the auth header survives page refreshes.
 * We use localStorage because cross-origin deployments (Vercel → Render)
 * prevent httpOnly cookies from being stored by the browser's third-party
 * cookie policy. The token is stored as a plain string; it's already signed
 * and verified server-side so there is no security benefit to encrypting it
 * in localStorage.
 */
export function saveToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

const api = axios.create({
  // In development: '/api' — Vite's proxy forwards to http://localhost:3001.
  // In production: VITE_API_URL points directly to the Render server URL.
  baseURL: import.meta.env.VITE_API_URL ?? '/api',

  // withCredentials: true keeps cookie-based auth working in development
  // (same-origin via Vite proxy). In production the Bearer header is used
  // instead because browsers block third-party cookies cross-origin.
  withCredentials: true,
})

// ---------------------------------------------------------------------------
// REQUEST INTERCEPTOR — attach Bearer token
// ---------------------------------------------------------------------------
// Runs before every request. If we have a stored JWT, add it as the
// Authorization header. The server checks this header before falling back
// to the cookie, so this works in both cross-origin (production) and
// same-origin (development) deployments.
api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

export default api
