/**
 * STOREFRONT ROUTES
 *
 * POST /api/storefronts           — create my storefront (seller only)
 * GET  /api/storefronts/my        — get my own storefront (seller only)
 * GET  /api/storefronts/slug/:slug — get any storefront by slug (public)
 * PUT  /api/storefronts/:id       — update my storefront (owner only)
 */

import express from 'express'
import { pool } from '../db/pool.js'
import { StorefrontSchema } from '@ambit/shared'
import { requireRole, authMiddleware } from '../middleware/auth.js'

const router = express.Router()

// ---------------------------------------------------------------------------
// POST /api/storefronts
// ---------------------------------------------------------------------------
// Express runs each item in the array as a middleware in order before the handler.
// So: check JWT → check role → run handler.
router.post('/', authMiddleware, async (req, res) => {
  const result = StorefrontSchema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten().fieldErrors })
  }

  const { display_name, slug, bio, avatar_url } = result.data

  // dedicated client so we can run multiple queries in a transaction. We want to make sure
  // that if the INSERT into storefronts succeeds but the UPDATE to users fails, we roll back
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // Insert the storefront record
    const { rows } = await client.query(
      `INSERT INTO storefronts (owner_id, slug, display_name, bio, avatar_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [req.user.id, slug, display_name, bio ?? null, avatar_url ?? null]
    )
    const storefront = rows[0]

    // Update the user's role to "seller", after the storefront is successfully created.
    await client.query(`UPDATE users SET role = 'seller' WHERE id = $1`, [req.user.id])

    await client.query('COMMIT')

    res.status(201).json({ storefront })
  } catch (err) {
    // If anything failed, roll back both the INSERT and UPDATE
    await client.query('ROLLBACK')

    if (err.code === '23505') {
      const field = err.constraint?.includes('slug') ? 'slug' : 'owner_id'
      const message =
        field === 'slug' ? 'That slug is already taken' : 'You already have a storefront'
      return res.status(409).json({ errors: { [field]: [message] } })
    }
    // eslint-disable-next-line no-console
    console.error('Create storefront error:', err)
    res.status(500).json({ error: 'Server error' })
  } finally {
    // Always release the connection back to the pool
    client.release()
  }
})
// ---------------------------------------------------------------------------
// GET /api/storefronts/my
// ---------------------------------------------------------------------------
// IMPORTANT: this route must be defined BEFORE /api/storefronts/:id
// because Express matches routes top-to-bottom. If :id came first,
// the word "my" would be captured as the id parameter.
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM storefronts WHERE owner_id = $1`, [
      req.user.id,
    ])

    // A seller might not have created their storefront yet — that's fine, return null
    res.json({ storefront: rows[0] ?? null })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Get my storefront error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// ---------------------------------------------------------------------------
// GET /api/storefronts/slug/:slug
// ---------------------------------------------------------------------------
// Public — no auth required. Used to render a seller's public shop page.
router.get('/slug/:slug', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM storefronts WHERE slug = $1`, [
      req.params.slug,
    ])

    if (!rows[0]) return res.status(404).json({ error: 'Storefront not found' })

    res.json({ storefront: rows[0] })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Get storefront by slug error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// ---------------------------------------------------------------------------
// PUT /api/storefronts/:id
// ---------------------------------------------------------------------------
// authMiddleware is used here (not requireRole) because we just need to be
// logged in — the ownership check below handles the "seller only" part.
router.put('/:id', authMiddleware, async (req, res) => {
  const result = StorefrontSchema.partial().safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten().fieldErrors })
  }

  const { display_name, slug, bio, avatar_url } = result.data

  try {
    // Fetch the storefront first so we can verify ownership.
    // Never trust the client to tell you who owns something — check the DB.
    const { rows: existing } = await pool.query(`SELECT * FROM storefronts WHERE id = $1`, [
      req.params.id,
    ])

    if (!existing[0]) return res.status(404).json({ error: 'Storefront not found' })

    // Only the owner can edit their storefront.
    // req.user.id comes from the verified JWT — safe to trust.
    if (existing[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const { rows } = await pool.query(
      `UPDATE storefronts
       SET display_name = COALESCE($1, display_name),
           slug         = COALESCE($2, slug),
           bio          = COALESCE($3, bio),
           avatar_url   = COALESCE($4, avatar_url)
       WHERE id = $5
       RETURNING *`,
      [display_name ?? null, slug ?? null, bio ?? null, avatar_url ?? null, req.params.id]
    )

    res.json({ storefront: rows[0] })
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ errors: { slug: ['That slug is already taken'] } })
    }
    // eslint-disable-next-line no-console
    console.error('Update storefront error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
