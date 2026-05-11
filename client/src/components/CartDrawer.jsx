import { useEffect } from 'react'
import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import useCartStore from '../store/cartStore.js'

export default function CartDrawer() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { items, isOpen, closeCart, removeItem, updateQuantity } = useCartStore()

  const productItems = items.filter((i) => i.listing.type === 'product')
  const serviceItems = items.filter((i) => i.listing.type === 'service')
  const total = items.reduce((sum, i) => sum + Number(i.listing.price) * i.quantity, 0)
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') closeCart()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [closeCart])

  function handleCheckout() {
    closeCart()
    if (user) {
      navigate('/checkout')
    } else {
      navigate('/login?next=/checkout')
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={closeCart} />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Cart{' '}
            {itemCount > 0 && (
              <span className="text-gray-400 font-normal text-base">({itemCount})</span>
            )}
          </h2>
          <button
            onClick={closeCart}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Close cart"
          >
            ×
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {items.length === 0 ? (
            <p className="text-gray-400 text-sm text-center mt-12">Your cart is empty.</p>
          ) : (
            <>
              {productItems.length > 0 && (
                <section>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
                    Products
                  </p>
                  <div className="space-y-4">
                    {productItems.map((item) => (
                      <CartItem
                        key={item.listing.id}
                        item={item}
                        onRemove={() => removeItem(item.listing.id)}
                        onQuantityChange={(q) => updateQuantity(item.listing.id, q)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {serviceItems.length > 0 && (
                <section>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
                    Services
                  </p>
                  <div className="space-y-4">
                    {serviceItems.map((item) => (
                      <CartItem
                        key={item.listing.id}
                        item={item}
                        onRemove={() => removeItem(item.listing.id)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-gray-200 px-6 py-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Subtotal</span>
              <span className="text-base font-semibold text-gray-900">${total.toFixed(2)}</span>
            </div>
            <button
              onClick={handleCheckout}
              className="w-full bg-indigo-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              {user ? 'Checkout' : 'Sign in to checkout'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

CartItem.propTypes = {
  item: PropTypes.shape({
    listing: PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      price: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      type: PropTypes.oneOf(['service', 'product']).isRequired,
      image_url: PropTypes.string,
      inventory_count: PropTypes.number,
    }).isRequired,
    quantity: PropTypes.number.isRequired,
    requestedDate: PropTypes.string,
  }).isRequired,
  onRemove: PropTypes.func.isRequired,
  onQuantityChange: PropTypes.func,
}

function CartItem({ item, onRemove, onQuantityChange }) {
  const { listing, quantity, requestedDate } = item
  const isService = listing.type === 'service'
  const maxInventory =
    listing.type === 'product' && listing.inventory_count !== null
      ? Number(listing.inventory_count)
      : null

  const reachedMaxInventory = maxInventory !== null && quantity >= maxInventory
  return (
    <div className="flex gap-3">
      {/* Image */}
      <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
        {listing.image_url ? (
          <img src={listing.image_url} alt={listing.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
            —
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 leading-snug truncate">{listing.title}</p>
        <p className="text-xs text-gray-400 mt-0.5">${Number(listing.price).toFixed(2)}</p>
        {isService && requestedDate && (
          <p className="text-xs text-indigo-600 mt-0.5">Booked: {requestedDate}</p>
        )}
        {isService && !requestedDate && (
          <p className="text-xs text-amber-500 mt-0.5">No date selected — set on checkout</p>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col items-end gap-2">
        <button
          onClick={onRemove}
          className="text-gray-300 hover:text-red-400 text-sm leading-none"
          aria-label="Remove"
        >
          ×
        </button>
        {!isService && onQuantityChange && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onQuantityChange(quantity - 1)}
              className="w-6 h-6 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 text-sm flex items-center justify-center"
            >
              −
            </button>
            <span className="text-sm w-6 text-center">{quantity}</span>
            <button
              onClick={() => onQuantityChange(quantity + 1)}
              disabled={reachedMaxInventory}
              className={`w-6 h-6 rounded border border-gray-200 text-sm flex items-center justify-center ${
                reachedMaxInventory
                  ? 'text-gray-300 bg-gray-100 cursor-not-allowed'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              +
            </button>
          </div>
        )}
      </div>
      {reachedMaxInventory && <p className="text-xs text-amber-600">Max stock reached</p>}
    </div>
  )
}
