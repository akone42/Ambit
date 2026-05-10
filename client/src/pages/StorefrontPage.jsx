/**
 * STOREFRONT PAGE
 *
 * Route: /shop/:slug
 * Accessible to: everyone (public)
 *
 * Shows a seller's public shop: their name, bio, and all their active listings.
 * Click any listing card to go to the detail page with full info + reviews.
 */

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../lib/axios.js'
import ListingCard from '../components/ListingCard.jsx'

export default function StorefrontPage() {
  const { slug } = useParams()

  const [storefront, setStorefront] = useState(null)
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    api
      .get(`/storefronts/slug/${slug}`)
      .then((res) => {
        setStorefront(res.data.storefront)
        return api.get(`/listings?storefront_id=${res.data.storefront.id}`)
      })
      .then((res) => {
        setListings(res.data.listings)
        setLoading(false)
      })
      .catch((err) => {
        if (err.response?.status === 404) setNotFound(true)
        setLoading(false)
      })
  }, [slug])

  if (loading) return <div className="p-8 text-gray-400">Loading…</div>

  if (notFound) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 text-lg">Shop not found.</p>
        <Link to="/" className="text-indigo-600 hover:underline text-sm mt-2 inline-block">
          Back to home
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* ── Storefront header ── */}
      <div className="flex items-start gap-4 mb-8">
        {storefront.avatar_url ? (
          <img
            src={storefront.avatar_url}
            alt={storefront.display_name}
            className="w-16 h-16 rounded-full object-cover border border-gray-200"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-2xl font-bold">
            {storefront.display_name[0].toUpperCase()}
          </div>
        )}

        <div>
          <h1 className="text-2xl font-bold text-gray-900">{storefront.display_name}</h1>
          {storefront.bio && (
            <p className="text-gray-500 text-sm mt-1 max-w-lg">{storefront.bio}</p>
          )}
        </div>
      </div>

      {/* ── Listings grid ── */}
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Listings</h2>

      {listings.length === 0 ? (
        <p className="text-gray-400 text-sm">This shop has no active listings yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  )
}
