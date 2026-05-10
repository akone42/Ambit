/**
 * AUTH ROUTES
 *
 * POST /api/auth/register   — create account, issue JWT cookie
 * POST /api/auth/login      — verify credentials, issue JWT cookie
 * POST /api/auth/logout     — clear JWT cookie
 * GET  /api/auth/me         — return current user (requires JWT)
 * PUT  /api/auth/me         — update profile (requires JWT)
 */

import express from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { pool } from '../db/pool.js'
import { RegisterSchema, LoginSchema, UpdateProfileSchema } from '@ambit/shared'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()

const SALT_ROUNDS = 12
const JWT_EXPIRES = '7d' // token expires after 7 days of inactivity

// ---------------------------------------------------------------------------
// HELPER: setJwtCookie
// ---------------------------------------------------------------------------
// We call this in both register and login — same logic, one place.
// Putting repeated logic in a function is called DRY: Don't Repeat Yourself.
//
// jwt.sign(payload, secret, options) creates the signed JWT string.
// res.cookie(name, value, options) tells the browser to store the cookie.
//
// Cookie options explained:
//   httpOnly: true    → browser sends it automatically but JS cannot read it
//   secure: true      → only sent over HTTPS (we relax this in development)
//   sameSite: Strict  → browser will NOT send this cookie on cross-site requests
//                       (major CSRF protection even before our CSRF token check)
//   maxAge            → cookie lifetime in milliseconds (7 days)
// setJwtCookie sets the token as an httpOnly cookie AND returns the raw token
// string so the caller can include it in the response body.
//
// Why return the raw token?
// In cross-origin deployments (Vercel → Render) browsers increasingly refuse
// to store third-party cookies even with SameSite=None; Secure. The frontend
// stores the raw token in localStorage and sends it as an Authorization header
// instead. The cookie is still set for same-origin/dev environments.
function setJwtCookie(res, payload) {
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES })

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  })

  // Return raw token so the client can use it as a Bearer token
  return token
}

// ---------------------------------------------------------------------------
// HELPER: safeUser
// ---------------------------------------------------------------------------
// We never send the hashed password to the client, even though it's hashed.
// This strips it from the user object before sending.
//
// Destructuring with rename: { password: _pw, ...rest }
//   - pulls out the 'password' field (named _pw so ESLint knows we intentionally ignore it)
//   - collects all other fields into 'rest'
// We return rest (everything except the password).
function safeUser(user) {
  // eslint-disable-next-line no-unused-vars
  const { password, ...rest } = user
  return rest
}

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------
router.post('/register', async (req, res) => {
  // Step 1: Validate the request body against our Zod schema.
  // safeParse() returns { success: true, data: {...} } or { success: false, error: {...} }
  // It never throws — unlike parse() which does.
  const result = RegisterSchema.safeParse(req.body)

  if (!result.success) {
    // flatten() converts Zod's error tree into a flat { fieldName: ['message'] } object
    // The client can then show "email: must be a valid email" next to the right input.
    return res.status(400).json({ errors: result.error.flatten().fieldErrors })
  }

  const { email, username, password } = result.data

  try {
    // Step 2: Hash the password.
    // bcrypt.hash(plaintext, saltRounds) returns a 60-character hash string.
    // It's async because it's intentionally slow (CPU-intensive).
    const hash = await bcrypt.hash(password, SALT_ROUNDS)

    // Step 3: Insert the new user.
    // We only select safe fields in RETURNING — never selecting 'password'.
    const { rows } = await pool.query(
      `INSERT INTO users (email, username, password)
       VALUES ($1, $2, $3)
       RETURNING id, email, username, role, display_name, avatar_url, bio, saved_shipping_address`,
      [email, username, hash]
    )

    const user = rows[0]

    // Step 4: Sign a JWT, set it as an httpOnly cookie, and get back the raw
    // token string so we can also return it in the response body.
    const token = setJwtCookie(res, { id: user.id, role: user.role })

    // 201 Created — the standard HTTP status for successful resource creation
    // token is included so the client can store it for Bearer auth in cross-origin setups
    res.status(201).json({ user: safeUser(user), token })
  } catch (err) {
    // PostgreSQL error code 23505 = unique_violation
    // This happens when email or username is already taken.
    // We check the constraint name to know WHICH field was duplicated.
    if (err.code === '23505') {
      const field = err.constraint?.includes('email') ? 'email' : 'username'
      return res.status(409).json({ errors: { [field]: [`${field} is already taken`] } })
    }
    // eslint-disable-next-line no-console
    console.error('Register error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
router.post('/login', async (req, res) => {
  const result = LoginSchema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten().fieldErrors })
  }

  const { email, password } = result.data

  try {
    // Fetch the user by email — we need the stored hash to compare against.
    // We SELECT password here (and only here) specifically to compare it.
    const { rows } = await pool.query(
      `SELECT id, email, username, password, role, display_name, avatar_url, bio, saved_shipping_address
       FROM users WHERE email = $1`,
      [email]
    )

    const user = rows[0]

    // bcrypt.compare(plaintext, hash) → true if they match, false otherwise.
    // We check BOTH "user doesn't exist" and "wrong password" with the same
    // response message on purpose — revealing which one failed helps attackers
    // enumerate valid emails. "Invalid credentials" tells them nothing.
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const token = setJwtCookie(res, { id: user.id, role: user.role })

    res.json({ user: safeUser(user), token })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Login error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------
router.post('/logout', (_req, res) => {
  // res.clearCookie() sets the cookie with an expiry in the past,
  // which tells the browser to delete it.
  res.clearCookie('token', {
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    secure: process.env.NODE_ENV === 'production',
  })
  res.json({ message: 'Logged out' })
})

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------
// authMiddleware runs first (it's the second argument to router.get).
// If the JWT is valid, req.user is populated and we reach the handler.
// If not, authMiddleware returns 401 and the handler never runs.
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // We always fetch from DB rather than reading from the JWT payload.
    // The JWT might be days old — the DB has the current truth.
    // (e.g. if an admin changed the user's role, the JWT still says 'buyer'
    //  but the DB says 'seller' — we want the DB version)
    const { rows } = await pool.query(
      `SELECT id, email, username, role, display_name, avatar_url, bio, saved_shipping_address
       FROM users WHERE id = $1`,
      [req.user.id]
    )

    if (!rows[0]) return res.status(404).json({ error: 'User not found' })

    res.json({ user: rows[0] })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Me error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// ---------------------------------------------------------------------------
// PUT /api/auth/me
// ---------------------------------------------------------------------------
router.put('/me', authMiddleware, async (req, res) => {
  const result = UpdateProfileSchema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten().fieldErrors })
  }

  const { display_name, bio, avatar_url, saved_shipping_address } = result.data

  try {
    // COALESCE($1, column) means: use $1 if it's not null, otherwise keep the existing value.
    // This lets clients send only the fields they want to update.
    // If display_name isn't in the request, $1 is null and COALESCE keeps the old value.
    const { rows } = await pool.query(
      `UPDATE users
       SET display_name = COALESCE($1, display_name),
           bio          = COALESCE($2, bio),
           avatar_url   = COALESCE($3, avatar_url),
           saved_shipping_address = COALESCE($4::jsonb, saved_shipping_address)
       WHERE id = $5
       RETURNING id, email, username, role, display_name, avatar_url, bio, saved_shipping_address`,
      [
        display_name ?? null,
        bio ?? null,
        avatar_url ?? null,
        saved_shipping_address ? JSON.stringify(saved_shipping_address) : null,
        req.user.id,
      ]
    )

    res.json({ user: rows[0] })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Update profile error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
