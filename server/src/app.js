/**
 * EXPRESS APP SETUP
 *
 * This file creates the Express app, registers middleware in the correct
 * order, and mounts all routers.
 *
 * It does NOT start the HTTP server.
 * That makes the app importable for tests using Supertest.
 */

import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { setCsrfCookie, verifyCsrf } from './middleware/csrf.js'
import authRouter from './routes/auth.js'
import storefrontsRouter from './routes/storefronts.js'
import listingsRouter from './routes/listings.js'
import uploadRouter from './routes/upload.js'
import cartRouter from './routes/cartRouter.js'
import ordersRouter from './routes/ordersRouter.js'
import bookingsRouter from './routes/bookingsRouter.js'
import paymentsRouter from './routes/payments.js'
import reviewsRouter from './routes/reviewsRouter.js'
import adminRouter from './routes/adminRouter.js'

const app = express()

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
)

app.use(express.json())
app.use(cookieParser())

app.use(setCsrfCookie)
app.use(verifyCsrf)

app.use('/api/auth', authRouter)
app.use('/api/storefronts', storefrontsRouter)
app.use('/api/listings', listingsRouter)
app.use('/api/upload', uploadRouter)
app.use('/api/cart', cartRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/bookings', bookingsRouter)
app.use('/api/payments', paymentsRouter)
app.use('/api/reviews', reviewsRouter)
app.use('/api/admin', adminRouter)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Returns the CSRF token in the response body so that cross-origin frontends
// (e.g. Vercel) can read it. We read from res.locals (set by setCsrfCookie)
// rather than req.cookies, because on the very first request the cookie is
// being set on the response — it won't appear in req.cookies until the browser
// sends it back on the next request.
app.get('/api/csrf-token', (_req, res) => {
  res.json({ csrfToken: res.locals.csrf_token })
})

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(err.stack)
  res.status(500).json({ error: 'Internal server error' })
})

export default app
