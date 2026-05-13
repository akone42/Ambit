/**
 * NAVBAR
 *
 * Displayed on every page. Shows different content based on auth state:
 *
 *   Not logged in:  Logo | [Login] [Register]
 *   Buyer:          Logo | alice (→/account) | Sell | [cart] | Logout
 *   Seller:         Logo | alice (→/account) | Dashboard | [cart] | Logout
 *
 * useAuth() gives us the current user — the Navbar re-renders automatically
 * whenever the user logs in or out because AuthContext state changed.
 *
 * Link vs <a>:
 *   React Router's <Link> navigates without a full page reload.
 *   A plain <a href="/login"> would reload the entire app from scratch,
 *   losing all React state. Always use <Link> for internal navigation.
 */

import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import useCartStore from '../store/cartStore.js'
import { useEffect, useState } from 'react'
import api from '../lib/axios.js'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { items, openCart } = useCartStore()
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)
  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => {
    if (!user) return
    api.get('/notifications').then((res) => setNotifications(res.data.notifications))
  }, [user])

  const unreadCount = notifications.filter((n) => !n.read).length

  async function handleOpenNotifications() {
    setShowNotifications((v) => !v)
    if (unreadCount > 0) {
      await api.put('/notifications/read')
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    }
  }

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between">
      <Link to="/" className="text-xl font-bold text-indigo-600 shrink-0">
        Ambit
      </Link>

      <div className="flex items-center gap-2 sm:gap-4">
        {user ? (
          <>
            {/* Clicking the username goes to the account page */}
            <Link
              to="/account"
              className="hidden sm:inline text-sm text-gray-600 hover:text-indigo-600 font-medium transition-colors"
            >
              {user.display_name || user.username}
            </Link>

            {/* Sellers see their dashboard; buyers see a prompt to start selling */}
            {user.role === 'seller' && (
              <Link
                to="/dashboard"
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Dashboard
              </Link>
            )}
            {user.role === 'buyer' && (
              <Link
                to="/dashboard"
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Sell
              </Link>
            )}
            {user.role === 'admin' && (
              <Link to="/admin" className="text-sm text-red-600 hover:text-red-800 font-medium">
                Admin
              </Link>
            )}

            <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-800">
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900">
              Login
            </Link>

            <Link
              to="/register"
              className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
            >
              Register
            </Link>
          </>
        )}

        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={handleOpenNotifications}
            className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Notifications"
          >
            <svg
              className="w-5 h-5 text-gray-600"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {showNotifications && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 top-11 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-40 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">Notifications</p>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No notifications yet.</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`px-4 py-3 border-b border-gray-50 ${!n.read ? 'bg-indigo-50' : ''}`}
                      >
                        <p className="text-sm font-medium text-gray-900">{n.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>
                        <p className="text-xs text-gray-300 mt-1">
                          {new Date(n.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Cart button — visible to everyone */}
        <button
          onClick={openCart}
          className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Open cart"
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
            />
          </svg>
          {itemCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
              {itemCount > 9 ? '9+' : itemCount}
            </span>
          )}
        </button>
      </div>
    </nav>
  )
}
