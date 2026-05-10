/**
 * CSRF MIDDLEWARE
 *
 * We use the double-submit cookie pattern:
 *   1. Server sets a csrf_token cookie that JavaScript CAN read (not httpOnly)
 *   2. Our React app reads that cookie and sends it back as an X-CSRF-Token header
 *   3. Server checks: header value === cookie value
 *
 * A malicious site can cause your browser to send cookies automatically,
 * but it cannot read your cookies or forge custom headers.
 * So a matching header proves the request came from our own frontend.
 */

import crypto from 'crypto'

const CSRF_COOKIE = 'csrf_token'
const CSRF_HEADER = 'x-csrf-token'

/**
 * setCsrfCookie
 *
 * Runs on every request. If the user doesn't have a csrf_token cookie yet,
 * we generate one and set it. This way the token is always available for
 * the frontend to read before it makes its first mutation.
 */
export function setCsrfCookie(req, res, next) {
  if (!req.cookies[CSRF_COOKIE]) {
    // crypto.randomBytes(32) generates 32 random bytes from the OS.
    // .toString('hex') converts them to a 64-character hex string.
    // This is cryptographically random — impossible to guess.
    const token = crypto.randomBytes(32).toString('hex')

    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false, // MUST be false — JS needs to read this one
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      secure: process.env.NODE_ENV === 'production',
    })

    // Store on res.locals so route handlers can read it on this same request.
    // (req.cookies won't have it yet — the cookie is being set on the response,
    // the browser only sends it back on the NEXT request.)
    res.locals[CSRF_COOKIE] = token
  } else {
    // Cookie already exists — mirror it into res.locals for consistency.
    res.locals[CSRF_COOKIE] = req.cookies[CSRF_COOKIE]
  }
  next()
}

/**
 * verifyCsrf
 *
 * Runs on every state-mutating request (POST, PUT, DELETE, PATCH).
 * GET/HEAD/OPTIONS are safe methods — they don't change data, so no CSRF risk.
 *
 * Checks that the X-CSRF-Token header matches the csrf_token cookie.
 * If they don't match (or either is missing), reject with 403.
 */
export function verifyCsrf(req, res, next) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS']
  if (process.env.NODE_ENV === 'test') return next()
  if (safeMethods.includes(req.method)) return next()

  const cookieToken = req.cookies[CSRF_COOKIE]
  const headerToken = req.headers[CSRF_HEADER]

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' })
  }

  next()
}
