/**
 * REVIEWS ROUTES
 *
 * POST /api/reviews              — submit a review (auth + purchase-verified)
 * GET  /api/reviews?listing_id=  — get all reviews for a listing (public)
 */

import express from 'express'
import { pool } from '../db/pool.js'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()

// ---------------------------------------------------------------------------
// POST /api/reviews
// ---------------------------------------------------------------------------
// Only buyers who have actually purchased the listing can leave a review.
// We verify this by checking order_items JOIN orders for this buyer + listing.
// The UNIQUE(listing_id, buyer_id) constraint in the DB prevents duplicates.
router.post('/', authMiddleware, async (req, res) => {
  const { listing_id, rating, body } = req.body

  if (!listing_id || !rating) {
    return res.status(400).json({ error: 'listing_id and rating are required' })
  }

  if (!Number.isInteger(Number(rating)) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'rating must be a whole number between 1 and 5' })
  }

  try {
    // Purchase verification — did this buyer actually buy this listing?
    const { rows: purchased } = await pool.query(
      `SELECT 1
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.buyer_id = $1
         AND oi.listing_id = $2
         AND o.status IN ('confirmed', 'fulfilled')
       LIMIT 1`,
      [req.user.id, listing_id]
    )

    if (!purchased.length) {
      return res.status(403).json({ error: 'You can only review listings you have purchased.' })
    }

    const { rows } = await pool.query(
      `INSERT INTO reviews (listing_id, buyer_id, rating, body)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [listing_id, req.user.id, Number(rating), body ?? null]
    )

    res.status(201).json({ review: rows[0] })
  } catch (err) {
    // Duplicate review — unique constraint violation
    if (err.code === '23505') {
      return res.status(409).json({ error: 'You have already reviewed this listing.' })
    }
    // eslint-disable-next-line no-console
    console.error('Create review error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// ---------------------------------------------------------------------------
// GET /api/reviews?listing_id=:id
// ---------------------------------------------------------------------------
// Public — anyone can read reviews.
// Returns reviews with the reviewer's username attached.
router.get('/', async (req, res) => {
  const { listing_id } = req.query

  if (!listing_id) {
    return res.status(400).json({ error: 'listing_id query param is required' })
  }

  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.rating, r.body, r.created_at, u.username
       FROM reviews r
       JOIN users u ON u.id = r.buyer_id
       WHERE r.listing_id = $1
       ORDER BY r.created_at DESC`,
      [listing_id]
    )

    res.json({ reviews: rows })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Get reviews error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
