/**
 * STOREFRONT PAGE
 *
 * Route: /shop/:slug
 * Accessible to: everyone (public)
 *
 * Shows a seller's public shop: their name, bio, all their active listings,
 * and the reviews left for each listing.
 */

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import PropTypes from 'prop-types'
import api from '../lib/axios.js'
import ListingCard from '../components/ListingCard.jsx'
import StarRating from '../components/StarRating.jsx'

// ── Reviews section shown under the listings grid ────────────────────────────
function ReviewsSection({ listings }) {
  const [reviewsByListing, setReviewsByListing] = useState({})
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading] = useState(false)

  async function loadReviews(listingId) {
    if (expanded === listingId) {
      setExpanded(null)
      return
    }
    setExpanded(listingId)
    if (reviewsByListing[listingId]) return // already loaded

    setLoading(true)
    try {
      const res = await api.get(`/reviews?listing_id=${listingId}`)
      setReviewsByListing((prev) => ({ ...prev, [listingId]: res.data.reviews }))
    } catch {
      setReviewsByListing((prev) => ({ ...prev, [listingId]: [] }))
    } finally {
      setLoading(false)
    }
  }

  // Only show listings that have at least one review
  const reviewable = listings.filter((l) => l.review_count > 0)
  if (!reviewable.length) return null

  return (
    <div className="mt-10">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Reviews</h2>
      <div className="space-y-3">
        {reviewable.map((listing) => (
          <div
            key={listing.id}
            className="bg-white border border-gray-200 rounded-xl overflow-hidden"
          >
            {/* Listing row — click to expand reviews */}
            <button
              onClick={() => loadReviews(listing.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-800">{listing.title}</span>
                <div className="flex items-center gap-1">
                  <StarRating value={Number(listing.avg_rating)} />
                  <span className="text-xs text-gray-400">
                    {Number(listing.avg_rating).toFixed(1)} ({listing.review_count})
                  </span>
                </div>
              </div>
              <span className="text-xs text-gray-400">{expanded === listing.id ? '▲' : '▼'}</span>
            </button>

            {/* Expanded review list */}
            {expanded === listing.id && (
              <div className="border-t border-gray-100 px-4 py-3 space-y-3">
                {loading && !reviewsByListing[listing.id] ? (
                  <p className="text-xs text-gray-400">Loading reviews…</p>
                ) : reviewsByListing[listing.id]?.length ? (
                  reviewsByListing[listing.id].map((review) => (
                    <div key={review.id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <StarRating value={review.rating} />
                        <span className="text-xs font-medium text-gray-700">{review.username}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(review.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {review.body && <p className="text-xs text-gray-600">{review.body}</p>}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400">No reviews yet.</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

ReviewsSection.propTypes = {
  listings: PropTypes.arrayOf(PropTypes.object).isRequired,
}

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

      {/* ── Reviews section ── */}
      <ReviewsSection listings={listings} />
    </div>
  )
}
