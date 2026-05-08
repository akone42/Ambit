import express from 'express'
import { pool } from '../db/pool.js'
import { authMiddleware } from '../middleware/auth.js'
import { OrderSchema, BookingSchema } from '@ambit/shared'

const router = express.Router()

// POST /api/orders — place a product order.
// Runs inside a transaction with SELECT FOR UPDATE so concurrent checkouts
// can't oversell the same inventory.
router.post('/', authMiddleware, async (req, res) => {
  const result = OrderSchema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten().fieldErrors })
  }

  const { shipping_address, items } = result.data
  const { stripe_pi_id } = req.body
  const listingIds = items.map((i) => i.listing_id)
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const { rows: listings } = await client.query(
      `SELECT id, title, price, type, inventory_count, status
       FROM listings WHERE id = ANY($1::uuid[])
       FOR UPDATE`,
      [listingIds]
    )

    const conflicts = []
    for (const item of items) {
      const listing = listings.find((l) => l.id === item.listing_id)
      if (!listing) {
        conflicts.push({ listing_id: item.listing_id, reason: 'Listing not found' })
        continue
      }
      if (listing.status !== 'active') {
        conflicts.push({
          listing_id: item.listing_id,
          title: listing.title,
          reason: 'No longer available',
        })
        continue
      }
      if (listing.inventory_count !== null && listing.inventory_count < item.quantity) {
        conflicts.push({
          listing_id: item.listing_id,
          title: listing.title,
          reason: 'Insufficient stock',
          available: listing.inventory_count,
          requested: item.quantity,
        })
      }
    }

    if (conflicts.length > 0) {
      await client.query('ROLLBACK')
      return res.status(409).json({ error: 'Inventory conflict', conflicts })
    }

    const total = items.reduce((sum, item) => {
      const listing = listings.find((l) => l.id === item.listing_id)
      return sum + Number(listing.price) * item.quantity
    }, 0)

    const {
      rows: [order],
    } = await client.query(
      `INSERT INTO orders (buyer_id, order_type, total, shipping_addr, stripe_pi_id)
       VALUES ($1, 'product', $2, $3, $4) RETURNING *`,
      [req.user.id, total, JSON.stringify(shipping_address), stripe_pi_id ?? null]
    )

    for (const item of items) {
      const listing = listings.find((l) => l.id === item.listing_id)
      await client.query(
        `INSERT INTO order_items (order_id, listing_id, quantity, price_at_purchase)
         VALUES ($1, $2, $3, $4)`,
        [order.id, item.listing_id, item.quantity, listing.price]
      )
      if (listing.inventory_count !== null) {
        await client.query(
          `UPDATE listings SET inventory_count = inventory_count - $1 WHERE id = $2`,
          [item.quantity, item.listing_id]
        )
      }
    }

    await client.query(
      `DELETE FROM cart_items WHERE user_id = $1 AND listing_id = ANY($2::uuid[])`,
      [req.user.id, listingIds]
    )

    await client.query('COMMIT')
    res.status(201).json({ order })
  } catch (err) {
    await client.query('ROLLBACK')
    // eslint-disable-next-line no-console
    console.error('Place order error:', err)
    res.status(500).json({ error: 'Server error' })
  } finally {
    client.release()
  }
})

// POST /api/orders/book — book a single service listing.
router.post('/book', authMiddleware, async (req, res) => {
  const result = BookingSchema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten().fieldErrors })
  }

  const { listing_id, requested_date } = result.data
  const { stripe_pi_id } = req.body

  try {
    const {
      rows: [listing],
    } = await pool.query(
      `SELECT * FROM listings WHERE id = $1 AND type = 'service' AND status = 'active'`,
      [listing_id]
    )
    if (!listing) {
      return res.status(404).json({ error: 'Service not found or no longer available' })
    }

    const {
      rows: [order],
    } = await pool.query(
      `INSERT INTO orders (buyer_id, order_type, total, requested_date)
       VALUES ($1, 'service', $2, $3) RETURNING *`,
      [req.user.id, listing.price, requested_date]
    )

    await pool.query(
      `INSERT INTO order_items (order_id, listing_id, quantity, price_at_purchase)
       VALUES ($1, $2, 1, $3)`,
      [order.id, listing_id, listing.price]
    )

    await pool.query(`DELETE FROM cart_items WHERE user_id = $1 AND listing_id = $2`, [
      req.user.id,
      listing_id,
    ])

    res.status(201).json({ order })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Book service error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
