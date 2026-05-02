import express from 'express'
import { requireRole, authMiddleware } from '../middleware/auth.js'
import * as cartService from '../services/cartService.js'

const router = express.Router()
router.use(authMiddleware)

// GET /cart - Get all items in the user's cart with listing and storefront details
router.get('/', async (req, res) => {
  try {
    const items = await cartService.getCart(req.user.id)
    res.json({ items })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cart' })
  }
})

// POST /cart/items - Add an item to the cart or update quantity if it already exists
router.post('/items', async (req, res) => {
  const { listingId, quantity = 1 } = req.body
  if (!listingId) return res.status(400).json({ error: 'listingId required' })
  try {
    const item = await cartService.addItem(req.user.id, listingId, quantity)
    res.status(201).json({ item })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    res.status(500).json({ error: 'Failed to add item' })
  }
})

// PUT /cart/items/:listingId - Update the quantity of an item in the cart
router.put('/items/:listingId', async (req, res) => {
  const { quantity } = req.body
  if (!quantity || quantity < 1) return res.status(400).json({ error: 'quantity must be >= 1' })
  try {
    const item = await cartService.updateItem(req.user.id, req.params.listingId, quantity)
    if (!item) return res.status(404).json({ error: 'Item not in cart' })
    res.json({ item })
  } catch (err) {
    res.status(500).json({ error: 'Failed to update item' })
  }
})

// DELETE /cart/items/:listingId - Remove an item from the cart
router.delete('/items/:listingId', async (req, res) => {
  try {
    await cartService.removeItem(req.user.id, req.params.listingId)
    res.status(204).send()
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove item' })
  }
})

// POST /cart/merge - Merge a guest cart into the user's cart upon login
router.post('/merge', async (req, res) => {
  const { guestCart } = req.body
  if (!Array.isArray(guestCart))
    return res.status(400).json({ error: 'guestCart must be an array' })
  try {
    await cartService.mergeGuestCart(req.user.id, guestCart)
    const items = await cartService.getCart(req.user.id)
    res.json({ items })
  } catch (err) {
    res.status(500).json({ error: 'Cart merge failed' })
  }
})

export default router
