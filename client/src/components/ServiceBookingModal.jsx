import { useState } from 'react'
import PropTypes from 'prop-types'
import useCartStore from '../store/cartStore.js'

// Min = tomorrow at 9am, max = 6 months from now — formatted for datetime-local input
function getDateBounds() {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(9, 0, 0, 0)
  const max = new Date()
  max.setMonth(max.getMonth() + 6)
  max.setHours(17, 0, 0, 0)

  // datetime-local needs "YYYY-MM-DDTHH:MM"
  const fmt = (d) => d.toISOString().slice(0, 16)
  return { min: fmt(tomorrow), max: fmt(max) }
}

export default function ServiceBookingModal({ listing, onClose }) {
  const [date, setDate] = useState('')
  const [error, setError] = useState('')
  const { addItem } = useCartStore()
  const { min, max } = getDateBounds()

  function handleConfirm() {
    if (!date) {
      setError('Please select a date and time.')
      return
    }
    addItem(listing, 1, date)
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Book Service</h2>
          <p className="text-sm text-gray-500 mb-5">{listing.title}</p>

          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Requested date &amp; time
            </label>
            <input
              type="datetime-local"
              min={min}
              max={max}
              value={date}
              onChange={(e) => {
                setDate(e.target.value)
                setError('')
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {listing.delivery_window_days && (
              <p className="text-xs text-gray-400 mt-1">
                Typical delivery: {listing.delivery_window_days} day
                {listing.delivery_window_days !== 1 ? 's' : ''}
              </p>
            )}
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-indigo-700"
            >
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

ServiceBookingModal.propTypes = {
  listing: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    delivery_window_days: PropTypes.number,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
}
