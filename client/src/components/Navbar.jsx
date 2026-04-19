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

export default function Navbar() {
  const { user, logout } = useAuth()

  // useNavigate returns a function that programmatically navigates.
  // We use it after logout to redirect to the homepage.
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      {/* Logo / brand name — always links to homepage */}
      <Link to="/" className="text-xl font-bold text-indigo-600">
        Ambit
      </Link>

      <div className="flex items-center gap-4">
        {user ? (
          // ── LOGGED IN ──────────────────────────────────────────────────
          <>
            <span className="text-sm text-gray-600">
              Hello, <span className="font-medium">{user.username}</span>
            </span>

            {/* Only sellers see the Dashboard link */}
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
          // ── NOT LOGGED IN ───────────────────────────────────────────────
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
      </div>
    </nav>
  )
}
