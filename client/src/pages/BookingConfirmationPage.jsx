import { useParams, Link } from 'react-router-dom'

export default function BookingConfirmationPage() {
  const { orderId } = useParams()

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-indigo-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-xl font-semibold text-gray-900 mb-2">Booking Confirmed!</h1>
        <p className="text-gray-500 text-sm mb-4">
          Your service has been booked successfully. The seller will be in touch soon.
        </p>

        <p className="text-xs text-gray-400 mb-6">
          Order ID: <span className="font-mono text-gray-600">{orderId}</span>
        </p>

        <div className="flex flex-col gap-3">
          <Link
            to="/orders"
            className="w-full bg-indigo-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            View My Bookings
          </Link>
          <Link to="/" className="w-full text-sm text-gray-500 hover:text-gray-700">
            Back to Listings
          </Link>
        </div>
      </div>
    </div>
  )
}
