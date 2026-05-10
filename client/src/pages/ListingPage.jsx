/**
 * LISTING DETAIL PAGE
 *
 * Route: /listings/:id
 * Accessible to: everyone (public)
 *
 * Shows full listing info, all reviews, and a review form for
 * buyers who have purchased this listing.
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import PropTypes from 'prop-types'
import api from '../lib/axios.js'
import { useAuth } from '../context/AuthContext.jsx'
import useCartStore from '../store/cartStore.js'
import StarRating from '../components/StarRating.jsx'
import ServiceBookingModal from '../components/ServiceBookingModal.jsx'

// ── Reviews section ───────────────────────────────────────────────────────────
function ReviewsSection({ listingId }) {
  const { user } = useAuth()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(0)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  const loadReviews = useCallback(() => {
    api
      .get(`/reviews?listing_id=${listingId}`)
      .then((res) => {
        setReviews(res.data.reviews)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [listingId])

  useEffect(() => {
    loadReviews()
  }, [loadReviews])

  async function handleSubmitReview(e) {
    e.preventDefault()
    if (!rating) return setReviewError('Please select a star rating.')
    setSubmitting(true)
    setReviewError(null)
    try {
      await api.post('/reviews', { listing_id: listingId, rating, body })
      setSubmitted(true)
      setRating(0)
      setBody('')
      loadReviews() // refresh list
    } catch (err) {
      setReviewError(err.response?.data?.error ?? 'Could not submit review.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-10">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Reviews{' '}
        {reviews.length > 0 && (
          <span className="text-gray-400 font-normal text-sm">({reviews.length})</span>
        )}
      </h2>

      {/* Review form — shown to any logged-in user; server enforces purchase check */}
      {user && !submitted && (
        <form
          onSubmit={handleSubmitReview}
          className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 space-y-3"
        >
          <p className="text-sm font-medium text-gray-700">Leave a review</p>
          <div className="flex items-center gap-2">
            <StarRating value={rating} interactive onChange={setRating} size="md" />
            {rating > 0 && <span className="text-xs text-gray-400">{rating} / 5</span>}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share your experience (optional)"
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {reviewError && <p className="text-sm text-red-500">{reviewError}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit review'}
          </button>
        </form>
      )}

      {submitted && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-green-700">✓ Your review has been submitted. Thank you!</p>
        </div>
      )}

      {!user && (
        <p className="text-sm text-gray-400 mb-6">
          <Link to="/login" className="text-indigo-600 hover:underline">
            Log in
          </Link>{' '}
          to leave a review.
        </p>
      )}

      {/* Review list */}
      {loading ? (
        <p className="text-sm text-gray-400">Loading reviews…</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-gray-400">No reviews yet. Be the first!</p>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="border-b border-gray-100 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <StarRating value={review.rating} />
                <span className="text-sm font-medium text-gray-800">{review.username}</span>
                <span className="text-xs text-gray-400">
                  {new Date(review.created_at).toLocaleDateString()}
                </span>
              </div>
              {review.body && <p className="text-sm text-gray-600">{review.body}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

ReviewsSection.propTypes = {
  listingId: PropTypes.string.isRequired,
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ListingPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { addItem, items } = useCartStore()
  const [listing, setListing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showBookingModal, setShowBookingModal] = useState(false)

  useEffect(() => {
    api
      .get(`/listings/${id}`)
      .then((res) => {
        setListing(res.data.listing)
        setLoading(false)
      })
      .catch((err) => {
        if (err.response?.status === 404) setNotFound(true)
        setLoading(false)
      })
  }, [id])

  if (loading) return <div className="p-8 text-gray-400">Loading…</div>

  if (notFound) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 text-lg">Listing not found.</p>
        <Link to="/" className="text-indigo-600 hover:underline text-sm mt-2 inline-block">
          Back to home
        </Link>
      </div>
    )
  }

  const inCart = items.some((i) => i.listing.id === listing.id)
  const outOfStock = listing.type === 'product' && listing.inventory_count === 0

  function handleAddToCart() {
    addItem(listing)
  }

  function handleBook() {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(location.pathname)}`)
      return
    }
    setShowBookingModal(true)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Back link */}
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-gray-400 hover:text-gray-600 mb-6 flex items-center gap-1"
      >
        ← Back
      </button>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Image */}
        {listing.image_url ? (
          <img src={listing.image_url} alt={listing.title} className="w-full h-64 object-cover" />
        ) : (
          <div className="w-full h-64 bg-gray-100 flex items-center justify-center text-gray-400">
            No image
          </div>
        )}

        <div className="p-6">
          {/* Type badge */}
          <span
            className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-3 ${
              listing.type === 'service'
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {listing.type}
          </span>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">{listing.title}</h1>

          {listing.category && <p className="text-sm text-gray-400 mb-3">{listing.category}</p>}

          {/* Star rating */}
          {listing.review_count > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <StarRating value={Number(listing.avg_rating)} size="md" />
              <span className="text-sm text-gray-500">
                {Number(listing.avg_rating).toFixed(1)} · {listing.review_count} review
                {listing.review_count !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          <p className="text-gray-600 text-sm leading-relaxed mb-4">{listing.description}</p>

          {/* Price + stock / delivery */}
          <div className="flex items-center gap-4 mb-4">
            <span className="text-2xl font-bold text-indigo-600">
              ${Number(listing.price).toFixed(2)}
            </span>
            {listing.type === 'product' && listing.inventory_count !== null && (
              <span
                className={`text-sm ${listing.inventory_count === 0 ? 'text-red-400' : 'text-gray-400'}`}
              >
                {listing.inventory_count === 0
                  ? 'Out of stock'
                  : `${listing.inventory_count} in stock`}
              </span>
            )}
            {listing.type === 'service' && listing.delivery_window_days && (
              <span className="text-sm text-gray-400">
                {listing.delivery_window_days} day delivery
              </span>
            )}
          </div>

          {/* Seller link */}
          {listing.storefront_slug && (
            <p className="text-sm text-gray-400 mb-6">
              Sold by{' '}
              <Link
                to={`/shop/${listing.storefront_slug}`}
                className="text-indigo-600 hover:underline font-medium"
              >
                {listing.storefront_name}
              </Link>
            </p>
          )}

          {/* CTA */}
          {listing.type === 'product' ? (
            <button
              onClick={handleAddToCart}
              disabled={outOfStock}
              className={`w-full py-3 rounded-xl font-medium transition-colors ${
                outOfStock
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : inCart
                    ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {outOfStock ? 'Out of stock' : inCart ? 'Add more to cart' : 'Add to cart'}
            </button>
          ) : (
            <button
              onClick={handleBook}
              className={`w-full py-3 rounded-xl font-medium transition-colors ${
                inCart
                  ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {inCart ? 'Change booking date' : 'Book this service'}
            </button>
          )}
        </div>
      </div>

      {/* Reviews */}
      <ReviewsSection listingId={listing.id} />

      {showBookingModal && (
        <ServiceBookingModal listing={listing} onClose={() => setShowBookingModal(false)} />
      )}
    </div>
  )
}
