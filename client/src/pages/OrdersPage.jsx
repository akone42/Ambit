/**
 * Order History page
 * Accessible to: any logged-in user (buyers and sellers)
 *
 * Shows the current user's full order history.
 * For confirmed/fulfilled orders, each item shows a "Leave a Review" form
 * if the buyer hasn't already reviewed that listing.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PropTypes from 'prop-types'
import api from '../lib/axios.js'
import StarRating from '../components/StarRating.jsx'

// ── Inline review form shown per order item ──────────────────────────────────
function ReviewForm({ listingId, listingTitle, onSubmitted }) {
  const [rating, setRating] = useState(0)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!rating) return setError('Please select a star rating.')
    setSubmitting(true)
    setError(null)
    try {
      await api.post('/reviews', { listing_id: listingId, rating, body })
      onSubmitted()
    } catch (err) {
      setError(err.response?.data?.error ?? 'Could not submit review.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 bg-gray-50 rounded-lg p-3 space-y-2">
      <p className="text-xs font-medium text-gray-700">Review: {listingTitle}</p>
      <div className="flex items-center gap-2">
        <StarRating value={rating} interactive onChange={setRating} size="md" />
        {rating > 0 && <span className="text-xs text-gray-400">{rating} / 5</span>}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share your experience (optional)"
        rows={2}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="bg-indigo-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
      >
        {submitting ? 'Submitting…' : 'Submit review'}
      </button>
    </form>
  )
}

ReviewForm.propTypes = {
  listingId: PropTypes.string.isRequired,
  listingTitle: PropTypes.string.isRequired,
  onSubmitted: PropTypes.func.isRequired,
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatingOrderId, setUpdatingOrderId] = useState(null)
  // Track which items have just been reviewed this session
  const [reviewed, setReviewed] = useState(new Set())

  useEffect(() => {
    api
      .get('/orders/my')
      .then((res) => {
        setOrders(res.data.orders)
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load orders.')
        setLoading(false)
      })
  }, [])

  const canCancel = (order) => {
    if (order.status === 'cancelled' || order.status === 'fulfilled') return false
    if (order.order_type === 'product') return order.status === 'pending'
    if (order.order_type === 'service') {
      if (!order.requested_date) return true
      return new Date(order.requested_date) > new Date()
    }
    return false
  }

  async function handleCancel(orderId) {
    if (!window.confirm('Cancel this order?')) return
    setUpdatingOrderId(orderId)
    try {
      const { data } = await api.post(`/orders/${orderId}/cancel`)
      setOrders((prev) => prev.map((order) => (order.id === orderId ? data.order : order)))
    } catch (err) {
      alert(err.response?.data?.error || 'Could not cancel order.')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  if (loading) return <div className="p-8 text-gray-400">Loading your orders…</div>
  if (error) return <div className="p-8 text-red-500">{error}</div>

  const canReview = (order) => order.status === 'confirmed' || order.status === 'fulfilled'

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Orders</h1>

      {orders.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-lg mb-2">No orders yet.</p>
          <Link to="/" className="text-indigo-600 hover:underline text-sm">
            Browse listings
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white border border-gray-200 rounded-xl p-5 space-y-3"
            >
              {/* Order header */}
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    order.order_type === 'service'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {order.order_type === 'service' ? 'Booking' : 'Product order'}
                </span>
                <span className="text-xs text-gray-400 capitalize">{order.status}</span>
              </div>

              <p className="text-xs text-gray-400 font-mono">Order ID: {order.id}</p>
              <p className="text-sm font-semibold text-gray-900">
                ${Number(order.total).toFixed(2)}
              </p>

              {order.order_type === 'service' && order.requested_date && (
                <p className="text-xs text-indigo-600">
                  Requested: {new Date(order.requested_date).toLocaleDateString()}
                </p>
              )}

              <p className="text-xs text-gray-400">
                Placed: {new Date(order.created_at).toLocaleDateString()}
              </p>

              {/* Order items + review forms */}
              {order.items?.length > 0 && (
                <div className="border-t border-gray-100 pt-3 space-y-3">
                  {order.items.map((item) => {
                    const alreadyReviewed = item.already_reviewed || reviewed.has(item.listing_id)
                    return (
                      <div key={item.listing_id}>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-700 font-medium">{item.listing_title}</p>
                          <p className="text-xs text-gray-400">
                            × {item.quantity} — ${Number(item.price_at_purchase).toFixed(2)}
                          </p>
                        </div>

                        {canReview(order) && alreadyReviewed && (
                          <p className="text-xs text-green-600 mt-1">✓ You reviewed this</p>
                        )}

                        {canReview(order) && !alreadyReviewed && (
                          <ReviewForm
                            listingId={item.listing_id}
                            listingTitle={item.listing_title}
                            onSubmitted={() =>
                              setReviewed((prev) => new Set([...prev, item.listing_id]))
                            }
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {canCancel(order) && (
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={() => handleCancel(order.id)}
                    disabled={updatingOrderId === order.id}
                    className="text-xs px-3 py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 disabled:opacity-50"
                  >
                    {updatingOrderId === order.id ? 'Cancelling…' : 'Cancel order'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
