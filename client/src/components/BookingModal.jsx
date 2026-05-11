import { useState } from 'react'
import PropTypes from 'prop-types'
import api from '../lib/axios.js'

export default function BookingModal({ listing, onClose, onSuccess }) {
  const [requestedDate, setRequestedDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit() {
    if (!requestedDate) {
      setError('Please select a date.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      // Use the configured axios instance — it automatically attaches the
      // in-memory CSRF token via the request interceptor.
      const { data } = await api.post('/bookings', {
        listingId: listing.id,
        requestedDate,
      })
      onSuccess(data.order)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Book Service</h2>
        <p className="text-sm text-gray-500 mb-4">{listing.title}</p>

        <label className="block text-sm font-medium text-gray-700 mb-1">Requested Date</label>
        <input
          type="date"
          value={requestedDate}
          onChange={(e) => setRequestedDate(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Booking...' : `Book for $${Number(listing.price).toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  )
}

BookingModal.propTypes = {
  listing: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    price: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func.isRequired,
}
