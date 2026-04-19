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

// ─── StorefrontForm ──────────────────────────────────────────────────────────
// Inline component — only used on this page, so no need for a separate file.
// Handles both CREATE (no existing storefront) and EDIT (storefront exists).
function StorefrontForm({ existing, onSave }) {
  const [form, setForm] = useState({
    display_name: existing?.display_name ?? '',
    slug: existing?.slug ?? '',
    bio: existing?.bio ?? '',
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

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
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

        <div className="col-span-2">
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

// ─── DashboardPage ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth()

  const [storefront, setStorefront] = useState(null)
  const [listings, setListings] = useState([])
  const [loadingStorefront, setLoadingStorefront] = useState(true)
  const [loadingListings, setLoadingListings] = useState(false)

  // UI state — which form is open
  const [editingStorefront, setEditingStorefront] = useState(false)
  const [showListingForm, setShowListingForm] = useState(false)
  const [editingListing, setEditingListing] = useState(null) // the listing object being edited

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
    api
      .get(`/listings?storefront_id=${storefront.id}`)
      .then((res) => {
        setListings(res.data.listings)
        setLoadingListings(false)
      })
      .catch(() => setLoadingListings(false))
  }, [storefront])

  function handleStorefrontSaved(saved) {
    setStorefront(saved)
    setEditingStorefront(false)
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
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="font-semibold text-gray-900">{storefront.display_name}</p>
            <p className="text-indigo-500 text-sm">/shop/{storefront.slug}</p>
            {storefront.bio && <p className="text-gray-500 text-sm mt-2">{storefront.bio}</p>}
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
            <ListingForm onSave={handleListingSaved} onCancel={() => setShowListingForm(false)} />
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
                      <ListingCard listing={listing} />
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
