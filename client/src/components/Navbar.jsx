/**
 * NAVBAR
 *
 * Displayed on every page. Shows different content based on auth state:
 *
 *   Not logged in:  Logo | [Login] [Register]
 *   Buyer:          Logo | Hello, frank | [Logout]
 *   Seller:         Logo | Hello, alice | [Dashboard] [Logout]
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

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { items, openCart } = useCartStore()
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)

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
            <span className="hidden sm:inline text-sm text-gray-600">
              Hello, <span className="font-medium">{user.username}</span>
            </span>

            <Link to="/orders" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
              Orders
            </Link>

            {user.role === 'seller' && (
              <Link
                to="/dashboard"
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Dashboard
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
