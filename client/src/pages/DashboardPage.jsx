/**
 * DASHBOARD PAGE
 *
 * Route: /dashboard
 * Accessible to: sellers only (ProtectedRoute enforces this in App.jsx)
 *
 * What it does:
 *   - Loads the seller's storefront on mount
 *   - If no storefront exists yet, shows a "Create Storefront" form
 *   - If storefront exists, shows their listings + a button to add more
 *   - Sellers can create/edit/delete their own listings from here
 */

import PropTypes from 'prop-types'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import api from '../lib/axios.js'
import ListingCard from '../components/ListingCard.jsx'
import ImageUploader from '../components/ImageUploader.jsx'

// ─── StorefrontForm ──────────────────────────────────────────────────────────
// Inline component — only used on this page, so no need for a separate file.
// Handles both CREATE (no existing storefront) and EDIT (storefront exists).
function StorefrontForm({ existing, onSave }) {
  const [form, setForm] = useState({
    display_name: existing?.display_name ?? '',
    slug: existing?.slug ?? '',
    bio: existing?.bio ?? '',
    avatar_url: existing?.avatar_url ?? '',
    // Cancel window — seller configures how long buyers have to cancel
    cancel_window_hours: existing?.cancel_window_hours ?? 24,
  })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  function handleChange(e) {
    const value = e.target.name === 'cancel_window_hours' ? Number(e.target.value) : e.target.value
    setForm((prev) => ({ ...prev, [e.target.name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      let res
      if (existing) {
        // PUT to update
        res = await api.put(`/storefronts/${existing.id}`, form)
      } else {
        // POST to create
        res = await api.post('/storefronts', form)
      }
      onSave(res.data.storefront)
    } catch (err) {
      const msg = err.response?.data?.errors
        ? Object.values(err.response.data.errors).flat().join(', ')
        : (err.response?.data?.error ?? 'Something went wrong')
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Shop name</label>
        <input
          name="display_name"
          value={form.display_name}
          onChange={handleChange}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Alice's Handmade Goods"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Slug{' '}
          <span className="text-gray-400 font-normal">
            (used in your shop URL: /shop/your-slug)
          </span>
        </label>
        <input
          name="slug"
          value={form.slug}
          onChange={handleChange}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="alice-handmade"
          pattern="[a-z0-9-]+"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
        <textarea
          name="bio"
          value={form.bio}
          onChange={handleChange}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Tell buyers about your shop..."
        />
      </div>

      <ImageUploader
        label="Shop avatar"
        currentUrl={form.avatar_url || null}
        onUpload={(url) => setForm((prev) => ({ ...prev, avatar_url: url }))}
      />

      {/* Cancel window — how long buyers have to cancel after placing an order */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Cancellation window{' '}
          <span className="text-gray-400 font-normal">(hours buyers have to cancel)</span>
        </label>
        <select
          name="cancel_window_hours"
          value={form.cancel_window_hours}
          onChange={handleChange}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value={1}>1 hour</option>
          <option value={6}>6 hours</option>
          <option value={12}>12 hours</option>
          <option value={24}>24 hours (default)</option>
          <option value={48}>48 hours</option>
          <option value={72}>72 hours</option>
        </select>
        <p className="text-xs text-gray-400 mt-1">
          Once you confirm an order, buyers cannot cancel regardless of this window.
        </p>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
      >
        {saving ? 'Saving…' : existing ? 'Save changes' : 'Create storefront'}
      </button>
    </form>
  )
}

// ─── ListingForm ─────────────────────────────────────────────────────────────
// Handles both CREATE and EDIT for listings.
// The key feature: shows different fields depending on whether type = 'service' or 'product'.
function ListingForm({ existing, onSave, onCancel }) {
  const [form, setForm] = useState({
    type: existing?.type ?? 'product',
    title: existing?.title ?? '',
    description: existing?.description ?? '',
    price: existing?.price ?? '',
    category: existing?.category ?? '',
    inventory_count: existing?.inventory_count ?? '',
    delivery_window_days: existing?.delivery_window_days ?? '',
    image_url: existing?.image_url ?? '',
  })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    // Build payload — only send the field relevant to the type
    const payload = {
      type: form.type,
      title: form.title,
      description: form.description,
      price: Number(form.price),
      category: form.category,
      ...(form.type === 'product'
        ? { inventory_count: Number(form.inventory_count) }
        : { delivery_window_days: Number(form.delivery_window_days) }),
      ...(form.image_url ? { image_url: form.image_url } : {}),
    }

    try {
      let res
      if (existing) {
        res = await api.put(`/listings/${existing.id}`, payload)
      } else {
        res = await api.post('/listings', payload)
      }
      onSave(res.data.listing)
    } catch (err) {
      const msg = err.response?.data?.errors
        ? Object.values(err.response.data.errors).flat().join(', ')
        : (err.response?.data?.error ?? 'Something went wrong')
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 bg-gray-50 border border-gray-200 rounded-xl p-5 mt-4"
    >
      <h3 className="font-semibold text-gray-800">{existing ? 'Edit listing' : 'New listing'}</h3>

      {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}

      {/* Type selector — only shown when creating, not editing */}
      {!existing && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            name="type"
            value={form.type}
            onChange={handleChange}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="product">Product</option>
            <option value="service">Service</option>
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="col-span-1 sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Price ($)</label>
          <input
            name="price"
            type="number"
            min="0.01"
            step="0.01"
            value={form.price}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <input
            name="category"
            value={form.category}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        {/* Conditional field — depends on listing type */}
        {form.type === 'product' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Inventory count</label>
            <input
              name="inventory_count"
              type="number"
              min="0"
              step="1"
              value={form.inventory_count}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Delivery window (days)
            </label>
            <input
              name="delivery_window_days"
              type="number"
              min="1"
              step="1"
              value={form.delivery_window_days}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>
        )}

        <div className="col-span-1 sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>
      </div>

      <ImageUploader
        label="Listing image"
        currentUrl={form.image_url || null}
        onUpload={(url) => setForm((prev) => ({ ...prev, image_url: url }))}
      />

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : existing ? 'Save changes' : 'Create listing'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-500 text-sm px-4 py-2 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── IncomingOrders ───────────────────────────────────────────────────────────
// Shows all orders placed for the seller's listings with status controls and cancel
function IncomingOrders({ storefrontId }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingOrder, setUpdatingOrder] = useState(null)

  useEffect(() => {
    api
      .get(`/orders/incoming?storefront_id=${storefrontId}`)
      .then((res) => setOrders(res.data.orders))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [storefrontId])

  async function handleStatusChange(orderId, status) {
    setUpdatingOrder(orderId)
    try {
      const { data } = await api.put(`/orders/${orderId}/status`, { status })
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: data.order.status } : o))
      )
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status')
    } finally {
      setUpdatingOrder(null)
    }
  }

  async function handleSellerCancel(orderId) {
    if (!window.confirm('Cancel this order? The buyer will be notified.')) return
    setUpdatingOrder(orderId)
    try {
      await api.post(`/orders/${orderId}/cancel`)
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: 'cancelled' } : o)))
    } catch (err) {
      alert(err.response?.data?.error || 'Could not cancel order.')
    } finally {
      setUpdatingOrder(null)
    }
  }

  if (loading) return <p className="text-gray-400 text-sm">Loading orders…</p>

  if (orders.length === 0) {
    return <p className="text-gray-400 text-sm">No incoming orders yet.</p>
  }

  const statusColors = {
    pending: 'bg-amber-100 text-amber-700',
    confirmed: 'bg-blue-100 text-blue-700',
    shipped: 'bg-indigo-100 text-indigo-700',
    fulfilled: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-600',
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <div key={order.id} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[order.status] ?? 'bg-gray-100 text-gray-500'}`}
              >
                {order.status}
              </span>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${order.order_type === 'service' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}
              >
                {order.order_type}
              </span>
            </div>
            <span className="text-sm font-semibold text-gray-900">
              ${Number(order.total).toFixed(2)}
            </span>
          </div>

          <p className="text-xs text-gray-500">
            From: <span className="font-medium">{order.buyer_username}</span>
          </p>
          <p className="text-xs text-gray-400">
            Placed: {new Date(order.created_at).toLocaleDateString()}
          </p>

          {order.requested_date && (
            <p className="text-xs text-indigo-600">
              Requested date: {new Date(order.requested_date).toLocaleDateString()}
            </p>
          )}

          {/* Order items */}
          {order.items?.length > 0 && (
            <div className="border-t border-gray-100 pt-2 space-y-1">
              {order.items.map((item) => (
                <div key={item.listing_id} className="flex justify-between text-xs text-gray-600">
                  <span>{item.listing_title}</span>
                  <span>
                    × {item.quantity} — ${Number(item.price_at_purchase).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Cancellation info if already cancelled */}
          {order.status === 'cancelled' && order.cancellation_reason && (
            <p className="text-xs text-red-400 border-t border-gray-100 pt-2">
              {order.cancellation_reason}
            </p>
          )}

          {/* Controls — only for non-cancelled, non-fulfilled orders */}
          {order.status !== 'cancelled' && order.status !== 'fulfilled' && (
            <div className="border-t border-gray-100 pt-3 flex flex-wrap gap-2 items-center">
              {/* Status update buttons */}
              {order.status === 'pending' && (
                <button
                  onClick={() => handleStatusChange(order.id, 'confirmed')}
                  disabled={updatingOrder === order.id}
                  className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Confirm order
                </button>
              )}
              {order.status === 'confirmed' && order.order_type === 'product' && (
                <button
                  onClick={() => handleStatusChange(order.id, 'shipped')}
                  disabled={updatingOrder === order.id}
                  className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  Mark shipped
                </button>
              )}
              {(order.status === 'shipped' || order.status === 'confirmed') && (
                <button
                  onClick={() => handleStatusChange(order.id, 'fulfilled')}
                  disabled={updatingOrder === order.id}
                  className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Mark fulfilled
                </button>
              )}

              {/* Seller cancel button */}
              <button
                onClick={() => handleSellerCancel(order.id)}
                disabled={updatingOrder === order.id}
                className="text-xs px-3 py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 disabled:opacity-50 ml-auto"
              >
                Cancel order
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── DashboardPage ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, refreshUser } = useAuth()

  const [storefront, setStorefront] = useState(null)
  const [listings, setListings] = useState([])
  const [loadingStorefront, setLoadingStorefront] = useState(true)
  const [loadingListings, setLoadingListings] = useState(false)

  // UI state — which form is open
  const [editingStorefront, setEditingStorefront] = useState(false)
  const [showListingForm, setShowListingForm] = useState(false)
  const [editingListing, setEditingListing] = useState(null) // the listing object being edited

  // Tab state — My Listings vs My Orders
  const [activeTab, setActiveTab] = useState('listings')

  // Load the seller's storefront on mount
  useEffect(() => {
    api
      .get('/storefronts/my')
      .then((res) => setStorefront(res.data.storefront))
      .catch(() => {}) // null storefront is fine — we show the create form
      .finally(() => setLoadingStorefront(false))
  }, [])

  // Load listings whenever we have a storefront
  useEffect(() => {
    if (!storefront) return

    let isCancelled = false

    const loadListings = async () => {
      setLoadingListings(true)
      try {
        const res = await api.get(`/listings?storefront_id=${storefront.id}`)
        if (!isCancelled) {
          setListings(res.data.listings)
        }
      } catch (err) {
        // ignore errors here, listings can stay empty
      } finally {
        if (!isCancelled) {
          setLoadingListings(false)
        }
      }
    }

    loadListings()

    return () => {
      isCancelled = true
    }
  }, [storefront])

  async function handleStorefrontSaved(saved) {
    setStorefront(saved)
    setEditingStorefront(false)

    // If the user just created a storefront, they might have been "upgraded" to seller role.
    // Refresh their auth state to get the new role, so they can access the dashboard features
    // without needing to log out and back in.
    await refreshUser()
  }

  function handleListingSaved(saved) {
    setListings((prev) => {
      const exists = prev.find((l) => l.id === saved.id)
      return exists ? prev.map((l) => (l.id === saved.id ? saved : l)) : [saved, ...prev]
    })
    setShowListingForm(false)
    setEditingListing(null)
  }

  async function handleDeleteListing(id) {
    if (!window.confirm('Delete this listing?')) return
    try {
      await api.delete(`/listings/${id}`)
      setListings((prev) => prev.filter((l) => l.id !== id))
    } catch {
      alert('Failed to delete listing')
    }
  }

  if (loadingStorefront) {
    return <div className="p-8 text-gray-400">Loading…</div>
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Seller Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Welcome back, {user?.username}</p>
      </div>

      {/* ── Storefront section ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">My Storefront</h2>
          {storefront && !editingStorefront && (
            <button
              onClick={() => setEditingStorefront(true)}
              className="text-sm text-indigo-600 hover:underline"
            >
              Edit
            </button>
          )}
        </div>

        {/* No storefront yet → show create form */}
        {!storefront && (
          <div>
            <p className="text-gray-500 text-sm mb-4">
              You don&apos;t have a storefront yet. Create one to start selling.
            </p>
            <StorefrontForm onSave={handleStorefrontSaved} />
          </div>
        )}

        {/* Has a storefront, not editing → show details */}
        {storefront && !editingStorefront && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-1">
            <p className="font-semibold text-gray-900">{storefront.display_name}</p>
            <p className="text-indigo-500 text-sm">/shop/{storefront.slug}</p>
            {storefront.bio && <p className="text-gray-500 text-sm">{storefront.bio}</p>}
            <p className="text-xs text-gray-400 pt-1">
              Cancellation window:{' '}
              <span className="font-medium text-gray-600">
                {storefront.cancel_window_hours ?? 24} hours
              </span>
            </p>
          </div>
        )}

        {/* Editing storefront → show edit form */}
        {storefront && editingStorefront && (
          <StorefrontForm existing={storefront} onSave={handleStorefrontSaved} />
        )}
      </section>

      {/* ── Listings section — only shown after storefront exists ── */}
      {storefront && (
        <section>
          {/* Tab bar */}
          <div className="flex gap-1 border-b border-gray-200 mb-6">
            <button
              onClick={() => setActiveTab('listings')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'listings'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              My Listings
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'orders'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              Incoming Orders
            </button>
          </div>

          {/* Listings tab */}
          {activeTab === 'listings' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800">My Listings</h2>
                {!showListingForm && !editingListing && (
                  <button
                    onClick={() => setShowListingForm(true)}
                    className="bg-indigo-600 text-white text-sm rounded-lg px-3 py-1.5 hover:bg-indigo-700"
                  >
                    + New listing
                  </button>
                )}
              </div>

              {/* New listing form */}
              {showListingForm && (
                <ListingForm
                  onSave={handleListingSaved}
                  onCancel={() => setShowListingForm(false)}
                />
              )}

              {/* Listings grid */}
              {loadingListings ? (
                <p className="text-gray-400 text-sm">Loading listings…</p>
              ) : listings.length === 0 ? (
                <p className="text-gray-400 text-sm">No listings yet. Add your first one!</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {listings.map((listing) => (
                    <div key={listing.id} className="relative">
                      {editingListing?.id === listing.id ? (
                        <ListingForm
                          existing={listing}
                          onSave={handleListingSaved}
                          onCancel={() => setEditingListing(null)}
                        />
                      ) : (
                        <>
                          <ListingCard listing={listing} isOwner />
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => setEditingListing(listing)}
                              className="text-xs text-indigo-600 hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteListing(listing.id)}
                              className="text-xs text-red-500 hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Orders tab */}
          {activeTab === 'orders' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Incoming Orders</h2>
              <IncomingOrders storefrontId={storefront.id} />
            </div>
          )}
        </section>
      )}
    </div>
  )
}

StorefrontForm.propTypes = {
  existing: PropTypes.object,
  onSave: PropTypes.func.isRequired,
}

ListingForm.propTypes = {
  existing: PropTypes.object,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
}

IncomingOrders.propTypes = {
  storefrontId: PropTypes.string.isRequired,
}
