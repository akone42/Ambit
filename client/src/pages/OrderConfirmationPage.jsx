/**
 * ORDER CONFIRMATION PAGE
 *
 * Route: /order-confirmation
 * Shown immediately after a successful checkout.
 *
 * Receives via React Router location.state:
 *   items           — snapshot of cart items at time of purchase
 *   shippingAddress — { street, city, state, zip, country }
 *   total           — grand total in dollars
 *
 * Shows a summary with items, total, shipping address, and an estimated
 * delivery window (5–7 business days from today). The buyer clicks
 * "Continue shopping" to go back to the home page.
 */

import { useLocation, useNavigate, Navigate } from 'react-router-dom'

// Return a date string N business days from today (skips Sat/Sun)
function addBusinessDays(date, days) {
  const result = new Date(date)
  let added = 0
  while (added < days) {
    result.setDate(result.getDate() + 1)
    const dow = result.getDay()
    if (dow !== 0 && dow !== 6) added++
  }
  return result
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function OrderConfirmationPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state

  // If someone navigates here directly (no state), send them home
  if (!state?.items) return <Navigate to="/" replace />

  const { items, shippingAddress, total } = state
  const productItems = items.filter((i) => i.listing.type === 'product')
  const serviceItems = items.filter((i) => i.listing.type === 'service')

  const today = new Date()
  const earliest = addBusinessDays(today, 5)
  const latest = addBusinessDays(today, 7)
  const deliveryWindow = `${formatDate(earliest)} – ${formatDate(latest)}`

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center py-16 px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 max-w-lg w-full p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-green-600"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Order confirmed!</h1>
          <p className="text-gray-500 text-sm mt-1">
            Thanks for your purchase. You&apos;ll receive a confirmation shortly.
          </p>
        </div>

        {/* Items */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Items ordered
          </h2>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.listing.id} className="flex justify-between text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-gray-900 truncate block">
                    {item.listing.title}
                  </span>
                  <span className="text-gray-400 text-xs capitalize">
                    {item.listing.type === 'product'
                      ? `Qty ${item.quantity}`
                      : item.requestedDate
                        ? `Booked for ${new Date(item.requestedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                        : 'Service'}
                  </span>
                </div>
                <span className="text-gray-900 font-medium ml-4 shrink-0">
                  $
                  {(
                    Number(item.listing.price) *
                    (item.listing.type === 'product' ? item.quantity : 1)
                  ).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 mt-4 pt-4 flex justify-between font-semibold text-gray-900">
            <span>Total paid</span>
            <span>${Number(total).toFixed(2)}</span>
          </div>
        </section>

        {/* Shipping address (products only) */}
        {productItems.length > 0 && shippingAddress && (
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Shipping to
            </h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              {shippingAddress.street}
              <br />
              {shippingAddress.city}, {shippingAddress.state} {shippingAddress.zip}
              <br />
              {shippingAddress.country}
            </p>

            <div className="mt-4 bg-indigo-50 rounded-xl px-4 py-3 flex items-center gap-3">
              <svg
                className="w-5 h-5 text-indigo-500 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <div>
                <p className="text-xs text-indigo-700 font-medium">Estimated delivery</p>
                <p className="text-sm text-indigo-900 font-semibold">{deliveryWindow}</p>
              </div>
            </div>
          </section>
        )}

        {/* Service bookings info */}
        {serviceItems.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Service bookings
            </h2>
            <p className="text-sm text-gray-600">
              The seller will reach out to confirm your booking details.
            </p>
          </section>
        )}

        {/* CTA */}
        <button
          onClick={() => navigate('/')}
          className="w-full bg-indigo-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          Continue shopping
        </button>
      </div>
    </div>
  )
}
