import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { createProductOrder } from '../services/orderService.js'

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

export default router
