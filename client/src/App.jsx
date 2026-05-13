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
import CartDrawer from './components/CartDrawer.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import StorefrontPage from './pages/StorefrontPage.jsx'
import HomePage from './pages/HomePage.jsx'
import BookingConfirmationPage from './pages/BookingConfirmationPage.jsx'
import CheckoutPage from './pages/CheckoutPage.jsx'
import OrdersPage from './pages/OrdersPage.jsx'
import ListingPage from './pages/ListingPage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import OrderConfirmationPage from './pages/OrderConfirmationPage.jsx'
import AccountPage from './pages/AccountPage.jsx'

function NotFoundPage() {
  return <div className="p-8 text-gray-500">404 — Page not found</div>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <CartDrawer />

          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route path="/shop/:slug" element={<StorefrontPage />} />
            <Route path="/listings/:id" element={<ListingPage />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
            <Route path="/booking-confirmation/:orderId" element={<BookingConfirmationPage />} />
            <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
            <Route
              path="/checkout"
              element={
                <ProtectedRoute>
                  <CheckoutPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <ProtectedRoute>
                  <OrdersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/account"
              element={
                <ProtectedRoute>
                  <AccountPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
