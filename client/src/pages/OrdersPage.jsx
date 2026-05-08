/**
 * Order History page
 * Accessible to: any logged-in user (buyers and sellers)
 *
 * Shows the current user's full order history —
 * both product orders and service bookings in one list.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/axios.js'

export default function OrdersPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .get('/orders/my')
      .then((res) => {
        setOrders(res.data.orders)
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load orders.')
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="p-8 text-gray-400">Loading your orders…</div>

  if (error) return <div className="p-8 text-red-500">{error}</div>

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Orders</h1>

      {orders.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-lg mb-2">No orders yet.</p>
          <Link to="/" className="text-indigo-600 hover:underline text-sm">
            Browse listings
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white border border-gray-200 rounded-xl p-5 space-y-2"
            >
              {/* Order header */}
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    order.order_type === 'service'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {order.order_type === 'service' ? 'Booking' : 'Product order'}
                </span>
                <span className="text-xs text-gray-400 capitalize">{order.status}</span>
              </div>

              {/* Order details */}
              <p className="text-xs text-gray-400 font-mono">Order ID: {order.id}</p>

              <p className="text-sm font-semibold text-gray-900">
                ${Number(order.total).toFixed(2)}
              </p>

              {/* Service booking date */}
              {order.order_type === 'service' && order.requested_date && (
                <p className="text-xs text-indigo-600">
                  Requested date: {new Date(order.requested_date).toLocaleDateString()}
                </p>
              )}

              {/* Order date */}
              <p className="text-xs text-gray-400">
                Placed: {new Date(order.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
