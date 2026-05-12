import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { createProductOrder, cancelOrder } from '../services/orderService.js'
import { pool } from '../db/pool.js'

const router = express.Router()

// POST /orders - Create an order from the user's cart with inventory validation
router.post('/', authMiddleware, async (req, res) => {
  const shippingAddress = req.body.shippingAddress || req.body.shipping_address
  if (!shippingAddress) return res.status(400).json({ error: 'shippingAddress required' })

  try {
    const order = await createProductOrder(req.user.id, { shippingAddress })
    res.status(201).json({ order })
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({ error: 'Inventory conflict', conflicts: err.conflicts })
    }
    if (err.status === 400) {
      return res.status(400).json({ error: err.message })
    }
    res.status(500).json({ error: 'Order creation failed' })
  }
})
// POST /orders/:id/cancel - Cancel an order if it's still pending and within the cancellation window
router.post('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const order = await cancelOrder(req.params.id, req.user.id)
    res.json({ order })
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: err.message })
    if (err.status === 400) return res.status(400).json({ error: err.message })
    if (err.status === 403) return res.status(403).json({ error: err.message })
    // eslint-disable-next-line no-console
    console.error('Cancel order error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})
// GET /api/orders/incoming?storefront_id=:id — seller sees orders for their listings
router.get('/incoming', authMiddleware, async (req, res) => {
  const { storefront_id } = req.query
  if (!storefront_id) return res.status(400).json({ error: 'storefront_id required' })

  try {
    // Verify requester owns this storefront
    const { rows: sf } = await pool.query(
      `SELECT id FROM storefronts WHERE id = $1 AND owner_id = $2`,
      [storefront_id, req.user.id]
    )
    if (!sf[0]) return res.status(403).json({ error: 'Forbidden' })

    const { rows: orders } = await pool.query(
      `SELECT DISTINCT o.*, u.username AS buyer_username
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN listings l ON l.id = oi.listing_id
       JOIN users u ON u.id = o.buyer_id
       WHERE l.storefront_id = $1
       ORDER BY o.created_at DESC`,
      [storefront_id]
    )

    if (orders.length === 0) return res.json({ orders: [] })

    const orderIds = orders.map((o) => o.id)
    const { rows: items } = await pool.query(
      `SELECT oi.order_id, oi.listing_id, oi.quantity, oi.price_at_purchase,
              l.title AS listing_title
       FROM order_items oi
       JOIN listings l ON l.id = oi.listing_id
       WHERE oi.order_id = ANY($1)`,
      [orderIds]
    )

    const itemsByOrder = {}
    for (const item of items) {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = []
      itemsByOrder[item.order_id].push(item)
    }

    res.json({
      orders: orders.map((o) => ({ ...o, items: itemsByOrder[o.id] ?? [] })),
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Get incoming orders error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/orders/:id/status — seller updates order status
router.put('/:id/status', authMiddleware, async (req, res) => {
  const { status } = req.body
  const validStatuses = ['confirmed', 'shipped', 'fulfilled', 'cancelled']

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` })
  }

  try {
    // Verify seller owns a listing in this order
    const { rows: check } = await pool.query(
      `SELECT o.id, o.buyer_id, o.order_type
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN listings l ON l.id = oi.listing_id
       JOIN storefronts s ON s.id = l.storefront_id
       WHERE o.id = $1 AND s.owner_id = $2
       LIMIT 1`,
      [req.params.id, req.user.id]
    )

    if (!check[0]) return res.status(403).json({ error: 'Forbidden' })

    const { rows } = await pool.query(`UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`, [
      status,
      req.params.id,
    ])

    // If seller just confirmed — notify buyer that cancellation is now blocked
    if (status === 'confirmed') {
      const { rows: sfRows } = await pool.query(
        `SELECT s.display_name
         FROM storefronts s
         JOIN listings l ON l.storefront_id = s.id
         JOIN order_items oi ON oi.listing_id = l.id
         WHERE oi.order_id = $1
         LIMIT 1`,
        [req.params.id]
      )

      const storeName = sfRows[0]?.display_name ?? 'The seller'

      await pool.query(
        `INSERT INTO notifications (user_id, type, title, body, order_id)
         VALUES ($1, 'cancellation_blocked', $2, $3, $4)`,
        [
          check[0].buyer_id,
          'Your order is now in production',
          `${storeName} has confirmed your order and begun production. Cancellation is no longer available.`,
          req.params.id,
        ]
      )
    }

    res.json({ order: rows[0] })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Update order status error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})
// Returns all orders placed by the currently logged-in buyer.
// Used by the buyer's order history page.
router.get('/my', authMiddleware, async (req, res) => {
  try {
    // Fetch orders
    const { rows: orders } = await pool.query(
      `SELECT * FROM orders WHERE buyer_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    )

    if (!orders.length) return res.json({ orders: [] })

    // Fetch all items for these orders in one query, with listing title + id
    const orderIds = orders.map((o) => o.id)
    const { rows: items } = await pool.query(
      `SELECT oi.order_id, oi.listing_id, oi.quantity, oi.price_at_purchase,
              l.title AS listing_title,
              -- has the buyer already reviewed this listing?
              EXISTS (
                SELECT 1 FROM reviews r
                WHERE r.listing_id = oi.listing_id AND r.buyer_id = $1
              ) AS already_reviewed
       FROM order_items oi
       JOIN listings l ON l.id = oi.listing_id
       WHERE oi.order_id = ANY($2)`,
      [req.user.id, orderIds]
    )

    // Group items by order_id and attach them
    const itemsByOrder = {}
    for (const item of items) {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = []
      itemsByOrder[item.order_id].push(item)
    }

    const ordersWithItems = orders.map((o) => ({
      ...o,
      items: itemsByOrder[o.id] ?? [],
    }))

    res.json({ orders: ordersWithItems })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Get my orders error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
