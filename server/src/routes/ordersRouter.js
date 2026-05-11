import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { createProductOrder } from '../services/orderService.js'
import { pool } from '../db/pool.js'

const router = express.Router()

// POST /orders - Create an order from the user's cart with inventory validation
router.post('/', authMiddleware, async (req, res) => {
  const shippingAddress = req.body.shippingAddress || req.body.shipping_address
  if (!shippingAddress) return res.status(400).json({ error: 'shippingAddress required' })

  try {
    const order = await createProductOrder(req.user.id, {
      shippingAddress,
      items: req.body.items, // client-side cart items: [{ listing_id, quantity }]
    })
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
