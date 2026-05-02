/**
 * EXPRESS ENTRY POINT
 *
 * This file creates the Express app, registers middleware in the correct
 * order, mounts all routers, and starts the HTTP server.
 *
 * Middleware ORDER matters. Each request flows top-to-bottom through this file.
 * If cors() isn't registered before your routes, cross-origin requests fail.
 * If cookieParser() isn't registered before authMiddleware, req.cookies is empty.
 */

import 'dotenv/config'
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

const app = express()
const PORT = process.env.PORT || 3001

// ---------------------------------------------------------------------------
// GLOBAL MIDDLEWARE
// ---------------------------------------------------------------------------

// cors() sets the Access-Control-Allow-Origin header.
// Without it, the browser blocks responses from a different origin.
// credentials: true is required when the frontend sends cookies.
// origin must be the exact frontend URL (not '*') when credentials are used.
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true, // allows cookies to be sent cross-origin
  })
)

// express.json() reads the request body and parses it from a JSON string
// into a JavaScript object, available as req.body.
// Without this, req.body is undefined.
app.use(express.json())

// cookie-parser reads the Cookie header and parses it into req.cookies.
// Without this, req.cookies is undefined and our JWT auth breaks.
app.use(cookieParser())

// setCsrfCookie ensures every response includes a readable csrf_token cookie
// so the frontend always has a token to send back on mutations.
app.use(setCsrfCookie)

// verifyCsrf checks that POST/PUT/DELETE requests include the correct
// X-CSRF-Token header. GET requests pass through unchecked.
app.use(verifyCsrf)

// ---------------------------------------------------------------------------
// ROUTES
// ---------------------------------------------------------------------------

// All auth routes are mounted under /api/auth.
// So router.post('/register') becomes POST /api/auth/register.
// The /api prefix is what our Vite proxy forwards to Express.
app.use('/api/auth', authRouter)
app.use('/api/storefronts', storefrontsRouter)
app.use('/api/listings', listingsRouter)
app.use('/api/upload', uploadRouter)
app.use('/api/cart', cartRouter)
app.use('/api/orders', ordersRouter)

// Health check — useful for confirming the server is running
// and for deployment platforms that ping this endpoint.
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// ---------------------------------------------------------------------------
// GLOBAL ERROR HANDLER
// ---------------------------------------------------------------------------
// Express identifies error handlers by their 4-argument signature: (err, req, res, next).
// If any route calls next(err) or throws inside an async handler caught by Express,
// it lands here instead of crashing the server.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(err.stack)
  res.status(500).json({ error: 'Internal server error' })
})

// ---------------------------------------------------------------------------
// START SERVER
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on http://localhost:${PORT}`)
})
