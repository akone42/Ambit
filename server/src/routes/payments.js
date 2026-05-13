/**
 * PAYMENT ROUTES
 *
 * POST /api/payments/create-intent    — create a PaymentIntent for checkout
 * POST /api/payments/setup-intent     — create a SetupIntent to save a card
 * GET  /api/payments/methods          — list the user's saved payment methods
 * DELETE /api/payments/methods/:id    — remove a saved payment method
 *
 * Stripe Customer lifecycle:
 *   A Stripe Customer is created lazily the first time a user calls
 *   setup-intent or create-intent. The customer ID is stored in
 *   users.stripe_customer_id so subsequent calls reuse the same customer.
 */

import express from 'express'
import Stripe from 'stripe'
import { authMiddleware } from '../middleware/auth.js'
import { pool } from '../db/pool.js'

const router = express.Router()

// Lazy singleton — only instantiated when the first request arrives.
// This prevents test suites from failing when STRIPE_SECRET_KEY is absent.
let _stripe = null
function getStripe() {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  }
  return _stripe
}

// ---------------------------------------------------------------------------
// HELPER: getOrCreateStripeCustomer
// ---------------------------------------------------------------------------
// Looks up the user's stripe_customer_id from the DB.
// If they don't have one yet, creates a Stripe Customer and stores the ID.
// Returns the stripe_customer_id string.
async function getOrCreateStripeCustomer(userId) {
  // 1. Check if we already have a customer ID
  const { rows } = await pool.query(
    `SELECT email, username, stripe_customer_id FROM users WHERE id = $1`,
    [userId]
  )
  const user = rows[0]
  if (!user) throw new Error('User not found')

  if (user.stripe_customer_id) return user.stripe_customer_id

  // 2. Create a new Stripe Customer
  const customer = await getStripe().customers.create({
    email: user.email,
    name: user.username,
    metadata: { ambit_user_id: userId },
  })

  // 3. Persist the customer ID so we reuse it forever
  await pool.query(`UPDATE users SET stripe_customer_id = $1 WHERE id = $2`, [customer.id, userId])

  return customer.id
}

// ---------------------------------------------------------------------------
// POST /api/payments/create-intent
// ---------------------------------------------------------------------------
// Creates a Stripe PaymentIntent for checkout.
// The frontend uses the client_secret to confirm payment via Stripe.js.
router.post('/create-intent', authMiddleware, async (req, res) => {
  const { amount, payment_method_id } = req.body // amount in cents

  if (!amount || typeof amount !== 'number' || amount < 50) {
    return res.status(400).json({ error: 'Amount must be at least $0.50' })
  }

  try {
    // Attach to Stripe Customer so the payment appears in their history
    const customerId = await getOrCreateStripeCustomer(req.user.id)

    const intentParams = {
      amount: Math.round(amount),
      currency: 'usd',
      customer: customerId,
    }

    // If the user chose a saved card, wire it up
    if (payment_method_id) {
      intentParams.payment_method = payment_method_id
      intentParams.confirm = false // frontend still confirms via stripe.js
    } else {
      intentParams.automatic_payment_methods = { enabled: true }
    }

    const paymentIntent = await getStripe().paymentIntents.create(intentParams)

    res.json({ clientSecret: paymentIntent.client_secret })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Stripe create-intent error:', err)
    res.status(500).json({ error: 'Failed to create payment intent' })
  }
})

// ---------------------------------------------------------------------------
// POST /api/payments/setup-intent
// ---------------------------------------------------------------------------
// Creates a Stripe SetupIntent so the user can save a card without paying.
// The frontend uses the client_secret with CardElement to tokenize the card.
// Once confirmed, the card is stored as a PaymentMethod on the Customer.
router.post('/setup-intent', authMiddleware, async (req, res) => {
  try {
    const customerId = await getOrCreateStripeCustomer(req.user.id)

    const setupIntent = await getStripe().setupIntents.create({
      customer: customerId,
      // Allow only card payment methods for simplicity
      payment_method_types: ['card'],
    })

    res.json({ clientSecret: setupIntent.client_secret })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Stripe setup-intent error:', err)
    res.status(500).json({ error: 'Failed to create setup intent' })
  }
})

// ---------------------------------------------------------------------------
// GET /api/payments/methods
// ---------------------------------------------------------------------------
// Lists all saved card payment methods for the logged-in user.
// Returns a simplified array of { id, brand, last4, exp_month, exp_year }.
router.get('/methods', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT stripe_customer_id FROM users WHERE id = $1`, [
      req.user.id,
    ])
    const customerId = rows[0]?.stripe_customer_id

    // No Stripe customer yet → they have no saved cards
    if (!customerId) return res.json({ methods: [] })

    const { data: paymentMethods } = await getStripe().customers.listPaymentMethods(customerId, {
      type: 'card',
    })

    // Return only the safe fields the frontend needs
    const methods = paymentMethods.map((pm) => ({
      id: pm.id,
      brand: pm.card.brand, // e.g. "visa", "mastercard"
      last4: pm.card.last4, // last 4 digits of the card number
      exp_month: pm.card.exp_month,
      exp_year: pm.card.exp_year,
    }))

    res.json({ methods })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('List payment methods error:', err)
    res.status(500).json({ error: 'Failed to fetch payment methods' })
  }
})

// ---------------------------------------------------------------------------
// DELETE /api/payments/methods/:id
// ---------------------------------------------------------------------------
// Detaches a saved payment method from the user's Stripe Customer.
// After this call the card is removed from their saved cards.
router.delete('/methods/:id', authMiddleware, async (req, res) => {
  const pmId = req.params.id

  try {
    // Verify the payment method actually belongs to this user's Stripe customer
    const { rows } = await pool.query(`SELECT stripe_customer_id FROM users WHERE id = $1`, [
      req.user.id,
    ])
    const customerId = rows[0]?.stripe_customer_id

    if (!customerId) {
      return res.status(404).json({ error: 'No saved payment methods found' })
    }

    const pm = await getStripe().paymentMethods.retrieve(pmId)
    if (pm.customer !== customerId) {
      // This card belongs to someone else — don't detach it
      return res.status(403).json({ error: 'Not your payment method' })
    }

    await getStripe().paymentMethods.detach(pmId)
    res.json({ success: true })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Detach payment method error:', err)
    res.status(500).json({ error: 'Failed to remove payment method' })
  }
})

export default router
