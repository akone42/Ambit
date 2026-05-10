/**
 * AUTH CONTEXT
 *
 * Provides authentication state and actions to the entire React tree.
 *
 * What's exported:
 *   AuthProvider  — wrap your app with this; it holds all the state
 *   useAuth       — call this inside any component to get { user, login, logout, register, loading }
 *
 * How it works:
 *   On mount, AuthProvider calls GET /api/auth/me to check if the user
 *   already has a valid JWT cookie (e.g. they logged in yesterday and
 *   refreshed the page). This is how the app knows you're logged in
 *   without you having to log in again every time.
 *
 *   If the cookie exists and is valid, the server returns the user object
 *   and we store it in state. If not (401 response), user stays null.
 */

import PropTypes from 'prop-types'
import { createContext, useContext, useEffect, useState } from 'react'
import api from '../lib/axios.js'
import useCartStore from '../store/cartStore.js'

// createContext() creates the context object.
// The argument (null) is the default value — only used if a component
// calls useAuth() outside of AuthProvider. We throw an error in that case
// instead, which is more helpful than a silent null.
const AuthContext = createContext(null)

// ---------------------------------------------------------------------------
// AuthProvider
// ---------------------------------------------------------------------------
export function AuthProvider({ children }) {
  // user: null = not logged in, object = the logged-in user
  const [user, setUser] = useState(null)

  // loading: true while we're checking the cookie on mount.
  // We show nothing (or a spinner) until loading is false,
  // so protected routes don't flash before we know the auth state.
  const [loading, setLoading] = useState(true)

  // On mount, ask the server "who am I?" using the cookie.
  // useEffect with an empty array [] runs once when the component mounts —
  // similar to "componentDidMount" in older React.
  useEffect(() => {
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => setUser(null)) // 401 means no valid cookie — that's fine
      .finally(() => setLoading(false))
  }, [])

  // ---------------------------------------------------------------------------
  // register(email, username, password)
  // ---------------------------------------------------------------------------
  // Calls POST /api/auth/register.
  // On success, the server sets the JWT cookie AND returns the user object.
  // We store the user in state — the app immediately knows the user is logged in.
  //
  // We re-throw errors so the form component can catch them and show error messages.
  async function register(email, username, password) {
    const res = await api.post('/auth/register', { email, username, password })
    setUser(res.data.user)
    return res.data.user
  }

  // ---------------------------------------------------------------------------
  // login(email, password)
  // ---------------------------------------------------------------------------
  async function login(email, password) {
    const res = await api.post('/auth/login', { email, password })
    setUser(res.data.user)
    return res.data.user
  }

  // ---------------------------------------------------------------------------
  // logout()
  // ---------------------------------------------------------------------------
  // Calls POST /api/auth/logout — the server clears the cookie.
  // We also set user to null locally so the UI updates immediately.
  async function logout() {
    await api.post('/auth/logout')
    setUser(null)
    useCartStore.getState().clearCart()
  }

  //refetch the user data from the server,
  // useful after actions that might change the user's role or permissions,
  // like creating a storefront
  async function refreshUser() {
    try {
      const res = await api.get('/auth/me')
      setUser(res.data.user)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to refresh user:', err)
    }
  }

  // The value object is what every useAuth() call receives.
  // We memo-ize nothing here for simplicity — this is fine for a class project.
  const value = { user, loading, register, login, logout, refreshUser }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
}

// ---------------------------------------------------------------------------
// useAuth hook
// ---------------------------------------------------------------------------
// A custom hook is just a function that calls other hooks.
// Naming convention: must start with 'use'.
//
// Usage in any component:
//   const { user, login, logout, loading } = useAuth()
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return context
}
