import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'

export default function ListingCard({ listing }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      {/* Image */}
      {listing.image_url ? (
        <img src={listing.image_url} alt={listing.title} className="w-full h-40 object-cover" />
      ) : (
        <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
          No image
        </div>
      )}

      <div className="p-4 flex flex-col flex-1">
        {/* Type badge */}
        <span
          className={`self-start text-xs font-medium px-2 py-0.5 rounded-full mb-2 ${
            listing.type === 'service'
              ? 'bg-indigo-100 text-indigo-700'
              : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          {listing.type}
        </span>

        <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-1">{listing.title}</h3>

        {listing.category && <p className="text-xs text-gray-400 mb-2">{listing.category}</p>}

        <p className="text-gray-500 text-xs line-clamp-2 flex-1">{listing.description}</p>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-indigo-600 font-bold text-sm">
            ${Number(listing.price).toFixed(2)}
          </span>

          {listing.type === 'product' && listing.inventory_count !== null && (
            <span className="text-xs text-gray-400">{listing.inventory_count} in stock</span>
          )}
          {listing.type === 'service' && listing.delivery_window_days !== null && (
            <span className="text-xs text-gray-400">{listing.delivery_window_days}d delivery</span>
          )}
        </div>

        {listing.storefront_slug && (
          <p className="text-xs text-gray-400 mt-2">
            by{' '}
            <Link
              to={`/shop/${listing.storefront_slug}`}
              className="text-indigo-500 hover:underline"
            >
              {listing.storefront_name}
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}

ListingCard.propTypes = {
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
  }).isRequired,
}
