/**
 * EMAIL UTILITY
 *
 * Sends transactional emails using nodemailer.
 *
 * Configuration (via environment variables):
 *   EMAIL_HOST  — SMTP host (default: smtp.gmail.com)
 *   EMAIL_PORT  — SMTP port (default: 587)
 *   EMAIL_USER  — SMTP username / Gmail address
 *   EMAIL_PASS  — SMTP password / Gmail App Password
 *   EMAIL_FROM  — Sender name+address (default: EMAIL_USER)
 *
 * If EMAIL_USER is not set, all send functions return silently
 * so the app works in dev/test without a real mail account.
 *
 * Gmail quickstart:
 *   1. Enable 2-Step Verification on your Google account
 *   2. Go to Security → App Passwords → generate one for "Mail"
 *   3. Set EMAIL_USER=you@gmail.com and EMAIL_PASS=<app-password>
 *
 * For testing without a real account, use Mailtrap (mailtrap.io) —
 * set EMAIL_HOST=sandbox.smtp.mailtrap.io, EMAIL_PORT=587,
 * EMAIL_USER and EMAIL_PASS from your Mailtrap inbox credentials.
 */

import nodemailer from 'nodemailer'

// Lazy singleton — only created when the first email is sent
let _transporter = null

function getTransporter() {
  if (_transporter) return _transporter
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return null

  _transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: false, // TLS via STARTTLS on port 587
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  })

  return _transporter
}

// Helper: the "from" field in all outgoing emails
function fromAddress() {
  return `"Ambit Marketplace" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`
}

// Helper: short order ID for subjects (first 8 chars, uppercased)
function shortId(id) {
  return id.slice(0, 8).toUpperCase()
}

// Helper: build a simple HTML item list
function itemListHtml(items) {
  return `<ul style="margin:8px 0;padding-left:20px">
    ${items
      .map(
        (i) =>
          `<li style="margin:4px 0">${i.title} × ${i.quantity} — <strong>$${Number(i.price).toFixed(2)}</strong></li>`
      )
      .join('')}
  </ul>`
}

// Helper: build a plain-text item list
function itemListText(items) {
  return items
    .map((i) => `  • ${i.title} × ${i.quantity} — $${Number(i.price).toFixed(2)}`)
    .join('\n')
}

// ---------------------------------------------------------------------------
// sendOrderConfirmationToBuyer
// ---------------------------------------------------------------------------
// Called after a successful product order or service booking.
//
// @param {string} to         - Buyer's email address
// @param {string} orderId    - Order UUID
// @param {number} total      - Order total in dollars
// @param {Array}  items      - [{ title, quantity, price }]
// @param {string} type       - 'product' | 'service'
// @param {string} [date]     - ISO date string for service bookings
export async function sendOrderConfirmationToBuyer({ to, orderId, total, items, type, date }) {
  const transporter = getTransporter()
  if (!transporter) return // email not configured — skip silently

  const label = type === 'service' ? 'Booking' : 'Order'
  const dateRow = date
    ? `<p style="margin:4px 0"><strong>Requested date:</strong> ${new Date(date).toLocaleDateString()}</p>`
    : ''
  const dateText = date ? `Requested date: ${new Date(date).toLocaleDateString()}\n` : ''

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h2 style="color:#4f46e5">Your ${label} is Confirmed! 🎉</h2>
      <p>Thanks for your purchase on <strong>Ambit</strong>.</p>
      <p style="margin:4px 0"><strong>${label} ID:</strong> #${shortId(orderId)}</p>
      ${dateRow}
      <p style="margin:4px 0"><strong>Total:</strong> $${Number(total).toFixed(2)}</p>
      <h3 style="margin-top:16px">Items</h3>
      ${itemListHtml(items)}
      <p style="margin-top:24px;color:#6b7280;font-size:13px">
        You can view your full order history at
        <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/orders">Ambit → My Orders</a>.
      </p>
    </div>`

  const text =
    `Your ${label} is confirmed!\n\n` +
    `${label} ID: #${shortId(orderId)}\n` +
    dateText +
    `Total: $${Number(total).toFixed(2)}\n\nItems:\n${itemListText(items)}\n\n` +
    `View your orders at: ${process.env.CLIENT_URL || 'http://localhost:5173'}/orders`

  try {
    await transporter.sendMail({
      from: fromAddress(),
      to,
      subject: `${label} Confirmed — #${shortId(orderId)}`,
      html,
      text,
    })
  } catch (err) {
    // Don't crash the request if email fails — just log it
    // eslint-disable-next-line no-console
    console.error('Failed to send buyer confirmation email:', err.message)
  }
}

// ---------------------------------------------------------------------------
// sendOrderNotificationToSeller
// ---------------------------------------------------------------------------
// Called after a successful product order or service booking.
//
// @param {string} to            - Seller's email address
// @param {string} orderId       - Order UUID
// @param {number} total         - Order total in dollars (seller's cut)
// @param {Array}  items         - [{ title, quantity, price }]
// @param {string} buyerUsername - Buyer's username
// @param {string} type          - 'product' | 'service'
// @param {string} [date]        - ISO date string for service bookings
export async function sendOrderNotificationToSeller({
  to,
  orderId,
  total,
  items,
  buyerUsername,
  type,
  date,
}) {
  const transporter = getTransporter()
  if (!transporter) return

  const label = type === 'service' ? 'Booking' : 'Order'
  const dateRow = date
    ? `<p style="margin:4px 0"><strong>Requested date:</strong> ${new Date(date).toLocaleDateString()}</p>`
    : ''
  const dateText = date ? `Requested date: ${new Date(date).toLocaleDateString()}\n` : ''

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h2 style="color:#4f46e5">You Have a New ${label}! 🛒</h2>
      <p><strong>${buyerUsername}</strong> just placed an order with you on <strong>Ambit</strong>.</p>
      <p style="margin:4px 0"><strong>${label} ID:</strong> #${shortId(orderId)}</p>
      ${dateRow}
      <p style="margin:4px 0"><strong>Total:</strong> $${Number(total).toFixed(2)}</p>
      <h3 style="margin-top:16px">Items ordered</h3>
      ${itemListHtml(items)}
      <p style="margin-top:24px">
        <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard"
           style="background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px">
          Go to Dashboard
        </a>
      </p>
    </div>`

  const text =
    `New ${label} from ${buyerUsername}!\n\n` +
    `${label} ID: #${shortId(orderId)}\n` +
    dateText +
    `Total: $${Number(total).toFixed(2)}\n\nItems:\n${itemListText(items)}\n\n` +
    `Manage your orders at: ${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard`

  try {
    await transporter.sendMail({
      from: fromAddress(),
      to,
      subject: `New ${label} — #${shortId(orderId)}`,
      html,
      text,
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to send seller notification email:', err.message)
  }
}
