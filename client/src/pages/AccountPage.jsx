/**
 * ACCOUNT PAGE
 *
 * Route: /account
 * Accessible to: any logged-in user (buyers and sellers)
 *
 * Sections:
 *   1. Profile      — edit display name, bio, avatar
 *   2. Address      — view / save a default shipping address
 *   3. Orders       — recent order history with inline reviews
 *   4. Payment      — saved Stripe credit/debit cards
 *
 * Buyer ↔ Seller:
 *   Everyone has an Account page regardless of role.
 *   Sellers see an extra "Seller Dashboard →" link that takes them
 *   to their storefront/listings management page.
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import PropTypes from 'prop-types'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useAuth } from '../context/AuthContext.jsx'
import api from '../lib/axios.js'
import StarRating from '../components/StarRating.jsx'
import ImageUploader from '../components/ImageUploader.jsx'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

// ── tiny shared style helpers ─────────────────────────────────────────────

const inputCls =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

function SectionCard({ title, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {children}
    </div>
  )
}
SectionCard.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
}

// ── 1. Profile Section ────────────────────────────────────────────────────

function ProfileSection({ user, onUpdated }) {
  const [form, setForm] = useState({
    display_name: user.display_name ?? '',
    bio: user.bio ?? '',
    avatar_url: user.avatar_url ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await api.put('/auth/me', {
        display_name: form.display_name || undefined,
        bio: form.bio || undefined,
        avatar_url: form.avatar_url || undefined,
      })
      onUpdated(res.data.user)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard title="Profile">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-4">
          {form.avatar_url ? (
            <img
              src={form.avatar_url}
              alt="Avatar"
              className="w-16 h-16 rounded-full object-cover border border-gray-200"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xl font-bold">
              {user.username[0].toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-medium text-gray-900">@{user.username}</p>
            <p className="text-xs text-gray-400">{user.email}</p>
            <span
              className={`text-xs mt-1 inline-block px-2 py-0.5 rounded-full font-medium ${
                user.role === 'seller'
                  ? 'bg-indigo-100 text-indigo-700'
                  : user.role === 'admin'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-600'
              }`}
            >
              {user.role}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Display name</label>
          <input
            name="display_name"
            value={form.display_name}
            onChange={handleChange}
            placeholder="Your public name"
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
          <textarea
            name="bio"
            value={form.bio}
            onChange={handleChange}
            rows={3}
            placeholder="Tell others a bit about yourself…"
            className={inputCls}
          />
        </div>

        <ImageUploader
          label="Profile photo"
          currentUrl={form.avatar_url || null}
          onUpload={(url) => setForm((prev) => ({ ...prev, avatar_url: url }))}
        />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save profile'}
        </button>
      </form>

      {/* Seller shortcut */}
      {user.role === 'seller' && (
        <div className="pt-4 border-t border-gray-100">
          <Link
            to="/dashboard"
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Go to Seller Dashboard →
          </Link>
        </div>
      )}
      {user.role === 'buyer' && (
        <div className="pt-4 border-t border-gray-100">
          <Link
            to="/dashboard"
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Start selling on Ambit →
          </Link>
        </div>
      )}
    </SectionCard>
  )
}
ProfileSection.propTypes = {
  user: PropTypes.object.isRequired,
  onUpdated: PropTypes.func.isRequired,
}

// ── 2. Address Section ────────────────────────────────────────────────────

function AddressSection({ user, onUpdated }) {
  const addr = user.saved_shipping_address
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    street: addr?.street ?? '',
    city: addr?.city ?? '',
    state: addr?.state ?? '',
    zip: addr?.zip ?? '',
    country: addr?.country ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await api.put('/auth/me', { saved_shipping_address: form })
      onUpdated(res.data.user)
      setEditing(false)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to save address')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard title="Default Shipping Address">
      {/* Display mode */}
      {!editing && (
        <>
          {addr ? (
            <div className="text-sm text-gray-700 space-y-0.5">
              <p>{addr.street}</p>
              <p>
                {addr.city}, {addr.state} {addr.zip}
              </p>
              <p>{addr.country}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No address saved yet.</p>
          )}
          <button
            onClick={() => setEditing(true)}
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            {addr ? 'Edit address' : 'Add address'}
          </button>
        </>
      )}

      {/* Edit mode */}
      {editing && (
        <form onSubmit={handleSave} className="space-y-3">
          <input
            name="street"
            value={form.street}
            onChange={handleChange}
            placeholder="Street"
            required
            className={inputCls}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              name="city"
              value={form.city}
              onChange={handleChange}
              placeholder="City"
              required
              className={inputCls}
            />
            <input
              name="state"
              value={form.state}
              onChange={handleChange}
              placeholder="State"
              required
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              name="zip"
              value={form.zip}
              onChange={handleChange}
              placeholder="ZIP"
              required
              className={inputCls}
            />
            <input
              name="country"
              value={form.country}
              onChange={handleChange}
              placeholder="Country"
              required
              className={inputCls}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save address'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-sm text-gray-500 px-4 py-2 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </SectionCard>
  )
}
AddressSection.propTypes = {
  user: PropTypes.object.isRequired,
  onUpdated: PropTypes.func.isRequired,
}

// ── 3. Order History Section ───────────────────────────────────────────────

function OrderHistorySection() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [reviewed, setReviewed] = useState(new Set())

  useEffect(() => {
    api
      .get('/orders/my')
      .then((res) => setOrders(res.data.orders))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <SectionCard title="Order History">
      {loading && <p className="text-sm text-gray-400">Loading…</p>}

      {!loading && orders.length === 0 && (
        <p className="text-sm text-gray-400">
          No orders yet.{' '}
          <Link to="/" className="text-indigo-600 hover:underline">
            Browse listings
          </Link>
        </p>
      )}

      {!loading && orders.length > 0 && (
        <div className="space-y-3">
          {orders.slice(0, 5).map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              reviewed={reviewed}
              onReviewed={(lid) => setReviewed((prev) => new Set([...prev, lid]))}
            />
          ))}
          {orders.length > 5 && (
            <Link
              to="/orders"
              className="block text-center text-sm text-indigo-600 hover:underline pt-1"
            >
              View all {orders.length} orders →
            </Link>
          )}
        </div>
      )}
    </SectionCard>
  )
}

// Single order row inside Order History
function OrderRow({ order, reviewed, onReviewed }) {
  const [showReviews, setShowReviews] = useState(false)
  const canReview = order.status === 'confirmed' || order.status === 'fulfilled'

  return (
    <div className="border border-gray-100 rounded-xl p-4 space-y-2">
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

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 font-mono">#{order.id.slice(0, 8).toUpperCase()}</p>
        <p className="text-sm font-semibold text-gray-900">${Number(order.total).toFixed(2)}</p>
      </div>

      <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString()}</p>

      {order.items?.length > 0 && (
        <button
          onClick={() => setShowReviews((v) => !v)}
          className="text-xs text-indigo-600 hover:underline"
        >
          {showReviews
            ? 'Hide items'
            : `View ${order.items.length} item${order.items.length > 1 ? 's' : ''}`}
        </button>
      )}

      {showReviews &&
        order.items?.map((item) => {
          const alreadyReviewed = item.already_reviewed || reviewed.has(item.listing_id)
          return (
            <div key={item.listing_id} className="pt-2 border-t border-gray-50">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-700 font-medium">{item.listing_title}</p>
                <p className="text-xs text-gray-400">
                  ×{item.quantity} — ${Number(item.price_at_purchase).toFixed(2)}
                </p>
              </div>
              {canReview && alreadyReviewed && (
                <p className="text-xs text-green-600 mt-1">✓ Reviewed</p>
              )}
              {canReview && !alreadyReviewed && (
                <MiniReviewForm
                  listingId={item.listing_id}
                  title={item.listing_title}
                  onSubmitted={() => onReviewed(item.listing_id)}
                />
              )}
            </div>
          )
        })}
    </div>
  )
}
OrderRow.propTypes = {
  order: PropTypes.object.isRequired,
  reviewed: PropTypes.instanceOf(Set).isRequired,
  onReviewed: PropTypes.func.isRequired,
}

function MiniReviewForm({ listingId, title, onSubmitted }) {
  const [rating, setRating] = useState(0)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!rating) return setError('Please select a rating.')
    setSubmitting(true)
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
    <form onSubmit={handleSubmit} className="mt-2 bg-gray-50 rounded-lg p-3 space-y-2">
      <p className="text-xs text-gray-600">Review: {title}</p>
      <StarRating value={rating} interactive onChange={setRating} size="md" />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share your experience (optional)"
        rows={2}
        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
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
MiniReviewForm.propTypes = {
  listingId: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  onSubmitted: PropTypes.func.isRequired,
}

// ── 4. Payment Methods Section ─────────────────────────────────────────────
//
// Uses Stripe SetupIntent to securely tokenise new cards.
// The flow:
//   a. User clicks "Add card"
//   b. We call POST /payments/setup-intent → get clientSecret
//   c. CardElement collects card details in the browser (never sent to our server)
//   d. stripe.confirmCardSetup(clientSecret) sends the card directly to Stripe
//   e. Stripe stores it on the Customer, we refresh the list

function PaymentSection() {
  return (
    <Elements stripe={stripePromise}>
      <PaymentSectionInner />
    </Elements>
  )
}

function PaymentSectionInner() {
  const [methods, setMethods] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [removing, setRemoving] = useState(null)

  useEffect(() => {
    loadMethods()
  }, [])

  async function loadMethods() {
    setLoading(true)
    try {
      const res = await api.get('/payments/methods')
      setMethods(res.data.methods)
    } catch {
      // If Stripe isn't configured, just show empty list
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove(id) {
    if (!window.confirm('Remove this card?')) return
    setRemoving(id)
    try {
      await api.delete(`/payments/methods/${id}`)
      setMethods((prev) => prev.filter((m) => m.id !== id))
    } catch {
      alert('Failed to remove card')
    } finally {
      setRemoving(null)
    }
  }

  // Brand icon text (could be replaced with SVG icons later)
  function brandLabel(brand) {
    const labels = {
      visa: 'Visa',
      mastercard: 'Mastercard',
      amex: 'Amex',
      discover: 'Discover',
      jcb: 'JCB',
      unionpay: 'UnionPay',
    }
    return labels[brand] || brand
  }

  return (
    <SectionCard title="Payment Methods">
      {loading && <p className="text-sm text-gray-400">Loading…</p>}

      {!loading && methods.length === 0 && !showForm && (
        <p className="text-sm text-gray-400">No saved cards yet.</p>
      )}

      {/* Saved cards list */}
      {!loading && methods.length > 0 && (
        <div className="space-y-2">
          {methods.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">{brandLabel(m.brand)}</span>
                <span className="text-sm text-gray-500">•••• {m.last4}</span>
                <span className="text-xs text-gray-400">
                  {m.exp_month}/{m.exp_year}
                </span>
              </div>
              <button
                onClick={() => handleRemove(m.id)}
                disabled={removing === m.id}
                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
              >
                {removing === m.id ? 'Removing…' : 'Remove'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add card button / form */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          + Add card
        </button>
      )}

      {showForm && (
        <AddCardForm
          onSaved={() => {
            setShowForm(false)
            loadMethods()
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </SectionCard>
  )
}

// Form that collects + saves a new card via Stripe SetupIntent
function AddCardForm({ onSaved, onCancel }) {
  const stripe = useStripe()
  const elements = useElements()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!stripe || !elements) return
    setSaving(true)
    setError(null)

    try {
      // 1. Ask our server to create a SetupIntent for this user
      const { data } = await api.post('/payments/setup-intent')

      // 2. Confirm the SetupIntent with the card details the user just entered.
      //    The card number NEVER touches our server — it goes directly to Stripe.
      const { error: stripeError } = await stripe.confirmCardSetup(data.clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
        },
      })

      if (stripeError) {
        setError(stripeError.message || 'Could not save card. Please try again.')
        return
      }

      // 3. Card saved successfully — refresh the list
      onSaved()
    } catch (err) {
      setError(err.response?.data?.error ?? 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-gray-50 rounded-xl p-4">
      <p className="text-sm font-medium text-gray-700">Add a new card</p>

      {/* Stripe's hosted card input — card number never goes through our server */}
      <div className="bg-white border border-gray-300 rounded-lg p-3">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '14px',
                color: '#111827',
                '::placeholder': { color: '#9ca3af' },
              },
              invalid: { color: '#ef4444' },
            },
          }}
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !stripe}
          className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save card'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-gray-500 px-4 py-2 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
AddCardForm.propTypes = {
  onSaved: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
}

// ── AccountPage (root) ─────────────────────────────────────────────────────

export default function AccountPage() {
  const { user, loading, refreshUser } = useAuth()

  if (loading) return <div className="p-8 text-gray-400">Loading…</div>
  if (!user) return null // ProtectedRoute handles redirect

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Account</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your profile, addresses, and payments</p>
      </div>

      <ProfileSection user={user} onUpdated={refreshUser} />
      <AddressSection user={user} onUpdated={refreshUser} />
      <OrderHistorySection />
      <PaymentSection />
    </div>
  )
}
