/**
 * PROTECTED ROUTE
 *
 * A wrapper component that guards routes requiring authentication.
 *
 * Usage in App.jsx:
 *   <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
 *
 * What it does:
 *   - While auth is loading (checking cookie on mount): shows nothing
 *   - If user is not logged in: redirects to /login
 *   - If user IS logged in: renders the children (the actual page)
 *
 * The optional `role` prop lets us restrict routes further:
 *   <ProtectedRoute role="seller"><SellerDashboard /></ProtectedRoute>
 *   → redirects to / if the user is logged in but isn't a seller
 */

import PropTypes from 'prop-types'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth()

  // While loading, render nothing — avoids a flash of the login page
  // before we know the user is actually logged in.
  if (loading) return null

  // Not logged in → redirect to login page.
  // The `replace` prop replaces the current history entry so the user
  // can't press "back" to get to the protected page.
  if (!user) return <Navigate to="/login" replace />

  // Logged in but wrong role → redirect to homepage.
  if (role && user.role !== role) return <Navigate to="/" replace />

  // All checks passed — render the actual page.
  return children
}

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  role: PropTypes.string,
}
