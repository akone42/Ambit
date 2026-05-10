import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import { createContext, useContext } from 'react'
import { useDarkMode } from './hooks/useDarkMode.js'
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

export const ThemeContext = createContext({ dark: false, toggleDark: () => {} })
export function useTheme() {
  return useContext(ThemeContext)
}

function NotFoundPage() {
  return <div className="p-8 text-gray-500 dark:text-gray-400">404 — Page not found</div>
}

export default function App() {
  const [dark, setDark] = useDarkMode()

  return (
    <ThemeContext.Provider value={{ dark, toggleDark: () => setDark((d) => !d) }}>
      <BrowserRouter>
        <AuthProvider>
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
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
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </div>
        </AuthProvider>
      </BrowserRouter>
    </ThemeContext.Provider>
  )
}
