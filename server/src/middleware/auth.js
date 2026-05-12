/**
 * AUTH MIDDLEWARE
 *
 * Two exports:
 *
 *   authMiddleware   — verifies the JWT cookie, attaches req.user
 *   requireRole(r)  — verifies JWT AND checks the role matches
 *
 * Usage in routes:
 *
 *   router.get('/me', authMiddleware, handler)
 *   router.post('/listings', requireRole('seller'), handler)
 *   router.get('/admin/users', requireRole('admin'), handler)
 */

import jwt from 'jsonwebtoken'

/**
 * authMiddleware
 *
 * Reads the 'token' cookie from the request.
 * Verifies it was signed with our JWT_SECRET (so we know it wasn't tampered with).
 * Attaches the decoded payload to req.user so route handlers can use it.
 *
 * The JWT payload we sign at login looks like: { id: 'uuid...', role: 'buyer' }
 * After this middleware runs, req.user === { id: 'uuid...', role: 'buyer' }
 */
export function authMiddleware(req, res, next) {
  // In cross-origin deployments (Vercel frontend + Render backend) browsers
  // treat the JWT cookie as a third-party cookie and may not store or send it.
  // We accept the token from TWO sources, in priority order:
  //   1. Authorization: Bearer <token> header  (preferred in cross-origin)
  //   2. 'token' httpOnly cookie               (works in same-origin / dev)
  const bearerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null
  const token = bearerToken || req.cookies?.token

  if (!token) {
    // 401 Unauthorized — the request has no authentication credentials at all
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    // jwt.verify() does two things:
    //   1. Checks the signature: was this token signed with our JWT_SECRET?
    //      If someone tampered with the payload, the signature won't match.
    //   2. Checks expiry: the token expires after 7 days (set when we sign it).
    //      An expired token throws an error here.
    const payload = jwt.verify(token, process.env.JWT_SECRET)

    // Attach the decoded payload to req so downstream handlers can use it
    req.user = payload // { id, role, iat, exp }

    next()
  } catch {
    // jwt.verify() throws if the token is invalid or expired
    return res.status(401).json({ error: 'Invalid or expired session' })
  }
}

/**
 * requireRole(role)
 *
 * Returns an ARRAY of two middleware functions.
 * Express accepts arrays — it runs them left to right, same as a chain.
 *
 * Step 1: authMiddleware verifies the JWT (same as above)
 * Step 2: checks that req.user.role matches the required role
 *
 * Why an array instead of a single function?
 * It lets us reuse authMiddleware logic without duplicating code.
 * requireRole('seller') === [authMiddleware, checkSellerRole]
 */
export function requireRole(role) {
  return [
    authMiddleware,
    (req, res, next) => {
      if (req.user.role !== role) {
        // 403 Forbidden — authenticated but not allowed
        // Different from 401 (not authenticated at all)
        return res.status(403).json({ error: 'Forbidden: insufficient role' })
      }
      next()
    },
  ]
}
