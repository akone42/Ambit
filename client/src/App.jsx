/**
 * APP ROOT
 *
 * This is the top of the React component tree. Everything renders inside here.
 *
 * Structure:
 *   BrowserRouter     — gives all child components access to routing (URL reading/writing)
 *     AuthProvider    — gives all child components access to auth state
 *       Navbar        — shown on every page
 *       Routes        — renders whichever Route matches the current URL
 *
 * React Router works by matching the current browser URL to a <Route path="...">
 * and rendering its element. Only one Route renders at a time (the best match).
 *
 * <Routes> → looks at all <Route> children → finds the one that matches the URL
 * <Route path="/login"> → renders LoginPage when URL is /login
 * <Route path="*"> → the wildcard — matches anything not matched above (404)
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import Navbar from './components/Navbar.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import StorefrontPage from './pages/StorefrontPage.jsx'
import HomePage from './pages/HomePage.jsx'
import BookingConfirmationPage from './pages/BookingConfirmationPage.jsx'

function NotFoundPage() {
  return <div className="p-8 text-gray-500">404 — Page not found</div>
}

export default function App() {
  return (
    <BrowserRouter>
      {/* AuthProvider wraps everything — any component inside can call useAuth() */}
      <AuthProvider>
        <div className="min-h-screen bg-gray-50">
          {/* Navbar appears on every page */}
          <Navbar />

          {/* Routes renders only the matching page */}
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* ProtectedRoute checks auth before rendering DashboardPage.
              If the user isn't logged in, they get redirected to /login.
              role="seller" means buyers also get redirected (to /) */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />

            <Route path="/shop/:slug" element={<StorefrontPage />} />

            {/* Catches any URL that didn't match above */}
            <Route path="/booking-confirmation/:orderId" element={<BookingConfirmationPage />} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
