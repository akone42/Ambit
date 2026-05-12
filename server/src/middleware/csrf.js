/**
 * CSRF MIDDLEWARE
 *
 * We defend against CSRF using Origin header verification.
 *
 * The double-submit cookie pattern breaks in cross-origin deployments
 * (e.g. Vercel frontend + Render backend) because modern browsers block
 * third-party cookies — the csrf_token cookie set by the API domain is
 * never stored or sent back by the browser.
 *
 * Origin-header checking is equally secure for a JSON API:
 *   - Browsers always set the Origin header on cross-origin requests
 *   - The Origin header cannot be forged by malicious sites
 *   - A request from evil.com will have Origin: https://evil.com,
 *     which won't match our CLIENT_URL — so we reject it
 *   - Our own frontend will have Origin: https://ambit-client.vercel.app
 *     (or localhost in dev) — so we allow it
 *
 * This is the standard CSRF defense for cross-origin SPAs and is used
 * by many major APIs.
 */

/**
 * setCsrfCookie — kept as a no-op for backwards compatibility.
 * The cookie approach is no longer used; this middleware is left in place
 * so we don't have to remove it from every route registration.
 */
export function setCsrfCookie(_req, _res, next) {
  next()
}

/**
 * verifyCsrf
 *
 * Runs on every state-mutating request (POST, PUT, DELETE, PATCH).
 * GET/HEAD/OPTIONS are safe methods — they don't change data, so no CSRF risk.
 *
 * In production: checks that the Origin header matches our frontend URL.
 * In development: allows requests with no Origin (e.g. from Postman/curl).
 * In test: skips entirely.
 */
export function verifyCsrf(req, res, next) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS']
  if (process.env.NODE_ENV === 'test') return next()
  if (safeMethods.includes(req.method)) return next()

  // In development, allow requests with no Origin header (Postman, curl, etc.)
  if (process.env.NODE_ENV !== 'production') return next()

  const origin = req.headers.origin
  const allowedOrigin = process.env.CLIENT_URL

  if (!origin || !allowedOrigin || origin !== allowedOrigin) {
    return res.status(403).json({ error: 'Invalid CSRF token' })
  }

  next()
}
