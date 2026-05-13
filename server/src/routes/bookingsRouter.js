import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { createServiceBooking } from '../services/bookingService.js'
import { pool } from '../db/pool.js'
import { sendOrderConfirmationToBuyer, sendOrderNotificationToSeller } from '../lib/email.js'

const router = express.Router()

router.post('/', authMiddleware, async (req, res) => {
  const { listingId, requestedDate } = req.body

  if (!listingId) return res.status(400).json({ error: 'listingId required' })
  if (!requestedDate) return res.status(400).json({ error: 'requestedDate required' })

  try {
    const order = await createServiceBooking(req.user.id, { listingId, requestedDate })
    res.status(201).json({ order })

    // Send confirmation emails in the background (don't block the response)
    sendEmailsForBooking(req.user.id, order, listingId).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Background email error (booking):', err.message)
    })
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

// ---------------------------------------------------------------------------
// sendEmailsForBooking  (internal helper — not a route)
// ---------------------------------------------------------------------------
// Fetches buyer + seller info from the DB and sends one email to each.
async function sendEmailsForBooking(buyerId, order, listingId) {
  const { rows: buyerRows } = await pool.query(`SELECT email, username FROM users WHERE id = $1`, [
    buyerId,
  ])
  const buyer = buyerRows[0]
  if (!buyer) return

  // Get listing title and seller contact via storefront → owner join
  const { rows: listingRows } = await pool.query(
    `SELECT l.title, l.price, u.email AS seller_email
     FROM listings l
     JOIN storefronts s ON s.id = l.storefront_id
     JOIN users u ON u.id = s.owner_id
     WHERE l.id = $1`,
    [listingId]
  )
  const listing = listingRows[0]
  if (!listing) return

  const items = [{ title: listing.title, quantity: 1, price: listing.price }]

  await sendOrderConfirmationToBuyer({
    to: buyer.email,
    orderId: order.id,
    total: order.total,
    items,
    type: 'service',
    date: order.requested_date,
  })

  await sendOrderNotificationToSeller({
    to: listing.seller_email,
    orderId: order.id,
    total: order.total,
    items,
    buyerUsername: buyer.username,
    type: 'service',
    date: order.requested_date,
  })
}

export default router
