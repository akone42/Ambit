import express from 'express'
import { pool } from '../db/pool.js'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()

const CART_QUERY = `
  SELECT ci.listing_id, ci.quantity,
         l.title, l.price, l.type, l.image_url,
         l.inventory_count, l.delivery_window_days, l.status,
         s.display_name AS storefront_name, s.slug AS storefront_slug
  FROM cart_items ci
  JOIN listings l ON l.id = ci.listing_id
  JOIN storefronts s ON s.id = l.storefront_id
  WHERE ci.user_id = $1
`

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(CART_QUERY, [req.user.id])
    res.json({ items: rows })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Get cart error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Upsert multiple items — used for guest-to-auth merge on login.
// Quantities are additive: if the item already exists on the server,
// we add the local quantity on top (so two sessions don't overwrite each other).
router.post('/sync', authMiddleware, async (req, res) => {
  const { items } = req.body
  if (!Array.isArray(items) || items.length === 0) {
    const { rows } = await pool.query(CART_QUERY, [req.user.id])
    return res.json({ items: rows })
  }

  try {
    for (const item of items) {
      await pool.query(
        `INSERT INTO cart_items (user_id, listing_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, listing_id)
         DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity`,
        [req.user.id, item.listing_id, item.quantity]
      )
    }
    const { rows } = await pool.query(CART_QUERY, [req.user.id])
    res.json({ items: rows })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Sync cart error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/:listing_id', authMiddleware, async (req, res) => {
  try {
    await pool.query(`DELETE FROM cart_items WHERE user_id = $1 AND listing_id = $2`, [
      req.user.id,
      req.params.listing_id,
    ])
    res.json({ message: 'Removed' })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Remove cart item error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
