import { useState } from 'react'
import PropTypes from 'prop-types'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import useCartStore from '../store/cartStore.js'
import ServiceBookingModal from './ServiceBookingModal.jsx'
import StarRating from './StarRating.jsx'

export default function ListingCard({ listing, isOwner = false }) {
  const detailUrl = `/listings/${listing.id}`
  const [showBookingModal, setShowBookingModal] = useState(false)
  const { addItem, items } = useCartStore()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const inCart = items.some((i) => i.listing.id === listing.id)
  const outOfStock = listing.type === 'product' && listing.inventory_count === 0

  function handleAddToCart(e) {
    e.preventDefault()
    addItem(listing)
  }

  function handleBook(e) {
    e.preventDefault()
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(location.pathname)}`)
      return
    }
    setShowBookingModal(true)
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col transition-colors duration-200">
        {/* Image — click to go to listing detail */}
        <Link to={detailUrl}>
          {listing.image_url ? (
            <img
              src={listing.image_url}
              alt={listing.title}
              className="w-full h-40 object-cover hover:opacity-90 transition-opacity"
            />
          ) : (
            <div className="w-full h-40 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              No image
            </div>
          )}
        </Link>

        <div className="p-4 flex flex-col flex-1">
          {/* Type badge */}
          <span
            className={`self-start text-xs font-medium px-2 py-0.5 rounded-full mb-2 ${
              listing.type === 'service'
                ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {listing.type}
          </span>

          <Link
            to={detailUrl}
            className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug mb-1">
              {listing.title}
            </h3>
          </Link>

          {listing.category && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{listing.category}</p>
          )}

          <p className="text-gray-500 dark:text-gray-400 text-xs line-clamp-2 flex-1">
            {listing.description}
          </p>

          {/* Star rating */}
          {listing.review_count > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <StarRating value={Number(listing.avg_rating)} />
              <span className="text-xs text-gray-400 dark:text-gray-500">
                ({listing.review_count})
              </span>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between">
            <span className="text-indigo-600 dark:text-indigo-400 font-bold text-sm">
              ${Number(listing.price).toFixed(2)}
            </span>

            {listing.type === 'product' && listing.inventory_count !== null && (
              <span
                className={`text-xs ${listing.inventory_count === 0 ? 'text-red-400' : 'text-gray-400 dark:text-gray-500'}`}
              >
                {listing.inventory_count === 0
                  ? 'Out of stock'
                  : `${listing.inventory_count} in stock`}
              </span>
            )}
            {listing.type === 'service' && listing.delivery_window_days !== null && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {listing.delivery_window_days}d delivery
              </span>
            )}
          </div>

          {listing.storefront_slug && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              by{' '}
              <Link
                to={`/shop/${listing.storefront_slug}`}
                className="text-indigo-500 dark:text-indigo-400 hover:underline"
              >
                {listing.storefront_name}
              </Link>
            </p>
          )}

          {/* CTA — hidden on your own listings */}
          {isOwner ? null : listing.type === 'product' ? (
            <button
              onClick={handleAddToCart}
              disabled={outOfStock}
              className={`mt-3 w-full py-2 rounded-lg text-xs font-medium transition-colors ${
                outOfStock
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                  : inCart
                    ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {outOfStock ? 'Out of stock' : inCart ? 'Add more' : 'Add to cart'}
            </button>
          ) : (
            <button
              onClick={handleBook}
              className={`mt-3 w-full py-2 rounded-lg text-xs font-medium transition-colors ${
                inCart
                  ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {inCart ? 'Change date' : 'Book'}
            </button>
          )}
        </div>
      </div>

      {showBookingModal && (
        <ServiceBookingModal listing={listing} onClose={() => setShowBookingModal(false)} />
      )}
    </>
  )
}

ListingCard.propTypes = {
  isOwner: PropTypes.bool,
  listing: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    description: PropTypes.string,
    price: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    type: PropTypes.oneOf(['service', 'product']).isRequired,
    category: PropTypes.string,
    image_url: PropTypes.string,
    inventory_count: PropTypes.number,
    delivery_window_days: PropTypes.number,
    storefront_name: PropTypes.string,
    storefront_slug: PropTypes.string,
    avg_rating: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    review_count: PropTypes.number,
  }).isRequired,
}
