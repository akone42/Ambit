import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { createServiceBooking } from '../services/bookingService.js'

const router = express.Router()

router.post('/', authMiddleware, async (req, res) => {
  const { listingId, requestedDate } = req.body

  if (!listingId) return res.status(400).json({ error: 'listingId required' })
  if (!requestedDate) return res.status(400).json({ error: 'requestedDate required' })

  try {
    const order = await createServiceBooking(req.user.id, { listingId, requestedDate })
    res.status(201).json({ order })
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ error: err.message })
    }
    if (err.status === 400) {
      return res.status(400).json({ error: err.message })
    }
    res.status(500).json({ error: 'Booking creation failed' })
  }
})

export default router
