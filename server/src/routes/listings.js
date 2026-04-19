/**
 * LISTING ROUTES
 *
 * POST   /api/listings           — create a listing (seller only)
 * GET    /api/listings           — browse/search all active listings (public)
 * GET    /api/listings/:id       — get one listing (public)
 * PUT    /api/listings/:id       — update a listing (owner only)
 * DELETE /api/listings/:id       — soft-delete a listing (owner only)
 */

import express from 'express'
import { pool } from '../db/pool.js'
import { ListingSchema, UpdateListingSchema } from '@ambit/shared'
import { requireRole, authMiddleware } from '../middleware/auth.js'

const router = express.Router()

// ---------------------------------------------------------------------------
// POST /api/listings
// ---------------------------------------------------------------------------
router.post('/', requireRole('seller'), async (req, res) => {
  // ListingSchema is a discriminatedUnion — Zod reads the `type` field first,
  // then applies either ServiceListingSchema or ProductListingSchema.
  const result = ListingSchema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten().fieldErrors })
  }

  const { type, title, description, price, category, inventory_count, delivery_window_days } =
    result.data

  try {
    // Sellers can only create listings under their own storefront.
    // We look up their storefront by owner_id, not by a client-supplied ID.
    const { rows: sf } = await pool.query(`SELECT id FROM storefronts WHERE owner_id = $1`, [
      req.user.id,
    ])

    if (!sf[0]) {
      return res.status(400).json({ error: 'You must create a storefront before adding listings' })
    }

    const storefrontId = sf[0].id

    const { rows } = await pool.query(
      `INSERT INTO listings
         (storefront_id, type, title, description, price, category, inventory_count, delivery_window_days)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        storefrontId,
        type,
        title,
        description,
        price,
        category,
        inventory_count ?? null,
        delivery_window_days ?? null,
      ]
    )

    res.status(201).json({ listing: rows[0] })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Create listing error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// ---------------------------------------------------------------------------
// GET /api/listings
// ---------------------------------------------------------------------------
// Public — no auth required.
// Supports optional query params: ?search=term&category=xyz&storefront_id=uuid
//
// Full-text search uses PostgreSQL's @@ operator against the search_vector column.
// to_tsquery() converts a search string into a query the @@ operator understands.
// plainto_tsquery() is the simpler version — it handles plain English phrases
// without requiring special syntax from the user.
router.get('/', async (req, res) => {
  const { search, category, storefront_id } = req.query

  try {
    // We build the WHERE clauses dynamically based on which query params were provided.
    // $1 is always status='active'. Additional params get added as needed.
    const conditions = [`l.status = 'active'`]
    const values = []
    let paramIndex = 1

    if (search) {
      // plainto_tsquery turns "logo design" into 'logo' & 'design'
      // @@ is the match operator: search_vector @@ query → true if the vector contains the query
      conditions.push(`l.search_vector @@ plainto_tsquery('english', $${paramIndex})`)
      values.push(search)
      paramIndex++
    }

    if (category) {
      conditions.push(`l.category ILIKE $${paramIndex}`)
      values.push(category)
      paramIndex++
    }

    if (storefront_id) {
      conditions.push(`l.storefront_id = $${paramIndex}`)
      values.push(storefront_id)
      paramIndex++
    }

    const whereClause = conditions.join(' AND ')

    // We JOIN storefronts so we can return the shop's display_name with each listing.
    // This lets the frontend show "Sold by Alice's Shop" without a second API call.
    const { rows } = await pool.query(
      `SELECT l.*, s.display_name AS storefront_name, s.slug AS storefront_slug
       FROM listings l
       JOIN storefronts s ON s.id = l.storefront_id
       WHERE ${whereClause}
       ORDER BY l.created_at DESC`,
      values
    )

    res.json({ listings: rows })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Browse listings error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// ---------------------------------------------------------------------------
// GET /api/listings/:id
// ---------------------------------------------------------------------------
// Public — anyone can view a listing detail page.
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT l.*, s.display_name AS storefront_name, s.slug AS storefront_slug
       FROM listings l
       JOIN storefronts s ON s.id = l.storefront_id
       WHERE l.id = $1 AND l.status != 'deleted'`,
      [req.params.id]
    )

    if (!rows[0]) return res.status(404).json({ error: 'Listing not found' })

    res.json({ listing: rows[0] })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Get listing error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// ---------------------------------------------------------------------------
// PUT /api/listings/:id
// ---------------------------------------------------------------------------
router.put('/:id', authMiddleware, async (req, res) => {
  const result = UpdateListingSchema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten().fieldErrors })
  }

  const { title, description, price, category, inventory_count, delivery_window_days, status } =
    result.data

  try {
    // Verify the listing exists and belongs to this seller's storefront
    const { rows: existing } = await pool.query(
      `SELECT l.*, s.owner_id
       FROM listings l
       JOIN storefronts s ON s.id = l.storefront_id
       WHERE l.id = $1`,
      [req.params.id]
    )

    if (!existing[0]) return res.status(404).json({ error: 'Listing not found' })
    if (existing[0].owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })

    const { rows } = await pool.query(
      `UPDATE listings
       SET title                = COALESCE($1, title),
           description          = COALESCE($2, description),
           price                = COALESCE($3, price),
           category             = COALESCE($4, category),
           inventory_count      = COALESCE($5, inventory_count),
           delivery_window_days = COALESCE($6, delivery_window_days),
           status               = COALESCE($7, status)
       WHERE id = $8
       RETURNING *`,
      [
        title ?? null,
        description ?? null,
        price ?? null,
        category ?? null,
        inventory_count ?? null,
        delivery_window_days ?? null,
        status ?? null,
        req.params.id,
      ]
    )

    res.json({ listing: rows[0] })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Update listing error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// ---------------------------------------------------------------------------
// DELETE /api/listings/:id
// ---------------------------------------------------------------------------
// Soft-delete: we set status='deleted' rather than removing the row.
// This preserves the listing for order history — past orders still reference it.
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows: existing } = await pool.query(
      `SELECT l.id, s.owner_id
       FROM listings l
       JOIN storefronts s ON s.id = l.storefront_id
       WHERE l.id = $1`,
      [req.params.id]
    )

    if (!existing[0]) return res.status(404).json({ error: 'Listing not found' })
    if (existing[0].owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })

    await pool.query(`UPDATE listings SET status = 'deleted' WHERE id = $1`, [req.params.id])

    res.json({ message: 'Listing deleted' })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Delete listing error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
