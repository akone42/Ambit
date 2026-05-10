/**
 * ADMIN ROUTES
 *
 * All routes here require requireRole('admin').
 * Admins can manage users, listings, and orders.
 *
 * GET  /api/admin/users                — list all users
 * PUT  /api/admin/users/:id/role       — change a user's role
 * GET  /api/admin/listings             — list all listings (any status)
 * PUT  /api/admin/listings/:id/status  — update listing status
 * GET  /api/admin/orders               — list all orders with buyer info
 * PUT  /api/admin/orders/:id/status    — update order status
 */

import express from 'express'
import { pool } from '../db/pool.js'
import { requireRole } from '../middleware/auth.js'

const router = express.Router()

// Every route in this file requires admin role
router.use(requireRole('admin'))

// ---------------------------------------------------------------------------
// GET /api/admin/users
// ---------------------------------------------------------------------------
router.get('/users', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.username, u.role, u.created_at,
              s.slug AS storefront_slug, s.display_name AS storefront_name
       FROM users u
       LEFT JOIN storefronts s ON s.owner_id = u.id
       ORDER BY u.created_at DESC`
    )
    res.json({ users: rows })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Admin get users error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// ---------------------------------------------------------------------------
// PUT /api/admin/users/:id/role
// ---------------------------------------------------------------------------
router.put('/users/:id/role', async (req, res) => {
  const { role } = req.body
  const validRoles = ['buyer', 'seller', 'admin']

  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` })
  }

  try {
    const { rows } = await pool.query(
      `UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, username, role`,
      [role, req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'User not found' })
    res.json({ user: rows[0] })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Admin update role error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// ---------------------------------------------------------------------------
// GET /api/admin/listings
// ---------------------------------------------------------------------------
router.get('/listings', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT l.id, l.title, l.type, l.price, l.status, l.created_at,
              s.display_name AS storefront_name, s.slug AS storefront_slug,
              u.username AS seller_username
       FROM listings l
       JOIN storefronts s ON s.id = l.storefront_id
       JOIN users u ON u.id = s.owner_id
       ORDER BY l.created_at DESC`
    )
    res.json({ listings: rows })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Admin get listings error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// ---------------------------------------------------------------------------
// PUT /api/admin/listings/:id/status
// ---------------------------------------------------------------------------
router.put('/listings/:id/status', async (req, res) => {
  const { status } = req.body
  const validStatuses = ['active', 'paused', 'deleted']

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` })
  }

  try {
    const { rows } = await pool.query(
      `UPDATE listings SET status = $1 WHERE id = $2
       RETURNING id, title, status`,
      [status, req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Listing not found' })
    res.json({ listing: rows[0] })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Admin update listing status error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// ---------------------------------------------------------------------------
// GET /api/admin/orders
// ---------------------------------------------------------------------------
router.get('/orders', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.id, o.order_type, o.status, o.total, o.created_at,
              u.username AS buyer_username, u.email AS buyer_email
       FROM orders o
       JOIN users u ON u.id = o.buyer_id
       ORDER BY o.created_at DESC`
    )
    res.json({ orders: rows })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Admin get orders error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// ---------------------------------------------------------------------------
// PUT /api/admin/orders/:id/status
// ---------------------------------------------------------------------------
router.put('/orders/:id/status', async (req, res) => {
  const { status } = req.body
  const validStatuses = ['pending', 'confirmed', 'shipped', 'fulfilled', 'cancelled']

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` })
  }

  try {
    const { rows } = await pool.query(
      `UPDATE orders SET status = $1 WHERE id = $2
       RETURNING id, status`,
      [status, req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Order not found' })
    res.json({ order: rows[0] })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Admin update order status error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
