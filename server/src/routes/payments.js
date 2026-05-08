import express from 'express'
import Stripe from 'stripe'
import { authMiddleware } from '../middleware/auth.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const router = express.Router()

// POST /api/payments/create-intent
// Creates a Stripe PaymentIntent and returns the client_secret to the frontend.
// The frontend uses it to confirm the payment via Stripe.js without the secret key
// ever touching the browser.
router.post('/create-intent', authMiddleware, async (req, res) => {
  const { amount } = req.body // amount in cents (e.g. $12.50 → 1250)

  if (!amount || typeof amount !== 'number' || amount < 50) {
    return res.status(400).json({ error: 'Amount must be at least $0.50' })
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount),
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
    })

    res.json({ clientSecret: paymentIntent.client_secret })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Stripe create-intent error:', err)
    res.status(500).json({ error: 'Failed to create payment intent' })
  }
})

export default router
