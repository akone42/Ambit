import { useState } from 'react'
import PropTypes from 'prop-types'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ShippingAddressSchema } from '@ambit/shared'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useAuth } from '../context/AuthContext.jsx'
import useCartStore from '../store/cartStore.js'
import api from '../lib/axios.js'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

export default function CheckoutPage() {
  const { items } = useCartStore()

  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-400 text-lg mb-4">Your cart is empty.</p>
        <Link to="/" className="text-indigo-600 hover:underline text-sm">
          Browse listings
        </Link>
      </div>
    )
  }

  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm />
    </Elements>
  )
}

function CheckoutForm() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { items, clearCart, setRequestedDate } = useCartStore()
  const stripe = useStripe()
  const elements = useElements()
  const [conflicts, setConflicts] = useState([])
  const [orderError, setOrderError] = useState('')
  const [isPlacing, setIsPlacing] = useState(false)

  const productItems = items.filter((i) => i.listing.type === 'product')
  const serviceItems = items.filter((i) => i.listing.type === 'service')
  const hasProducts = productItems.length > 0
  const hasServices = serviceItems.length > 0

  const saved = user?.saved_shipping_address
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: hasProducts ? zodResolver(ShippingAddressSchema) : undefined,
    defaultValues: saved || { street: '', city: '', state: '', zip: '', country: '' },
  })

  const productTotal = productItems.reduce(
    (sum, i) => sum + Number(i.listing.price) * i.quantity,
    0
  )
  const serviceTotal = serviceItems.reduce((sum, i) => sum + Number(i.listing.price), 0)
  const grandTotal = productTotal + serviceTotal

  const missingDates = serviceItems.filter((i) => !i.requestedDate)

  async function onSubmit(shippingData) {
    if (missingDates.length > 0) {
      setOrderError('Please select a date for all service bookings.')
      return
    }
    if (!stripe || !elements) return

    setIsPlacing(true)
    setConflicts([])
    setOrderError('')

    try {
      // 1. Create Stripe PaymentIntent on the server
      const { data } = await api.post('/payments/create-intent', {
        amount: Math.round(grandTotal * 100),
      })

      // 2. Confirm the card payment in the browser
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        data.clientSecret,
        {
          payment_method: {
            card: elements.getElement(CardElement),
          },
        }
      )

      if (stripeError) {
        setOrderError(stripeError.message || 'Payment failed. Please try again.')
        return
      }

      const stripe_pi_id = paymentIntent.id

      // 3. Record product order
      if (hasProducts) {
        await api.post('/orders', {
          shipping_address: shippingData,
          stripe_pi_id,
          items: productItems.map((i) => ({
            listing_id: i.listing.id,
            quantity: i.quantity,
          })),
        })
      }

      // 4. Book each service
      for (const item of serviceItems) {
        await api.post('/orders/book', {
          listing_id: item.listing.id,
          requested_date: item.requestedDate,
          stripe_pi_id,
        })
      }

      clearCart()
      navigate('/', { state: { orderSuccess: true } })
    } catch (err) {
      if (err.response?.status === 409) {
        setConflicts(err.response.data.conflicts || [])
        setOrderError('Some items have stock issues. Please review below.')
      } else {
        setOrderError(err.response?.data?.error || 'Something went wrong. Please try again.')
      }
    } finally {
      setIsPlacing(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Checkout</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left — shipping + service dates + payment */}
        <div className="lg:col-span-3 space-y-8">
          {hasProducts && (
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-4">Shipping address</h2>
              <div className="space-y-4">
                <Field label="Street" error={errors.street?.message}>
                  <input
                    {...register('street')}
                    placeholder="123 Main St"
                    className={inputCls(errors.street)}
                  />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="City" error={errors.city?.message}>
                    <input
                      {...register('city')}
                      placeholder="New York"
                      className={inputCls(errors.city)}
                    />
                  </Field>
                  <Field label="State" error={errors.state?.message}>
                    <input
                      {...register('state')}
                      placeholder="NY"
                      className={inputCls(errors.state)}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="ZIP" error={errors.zip?.message}>
                    <input
                      {...register('zip')}
                      placeholder="10001"
                      className={inputCls(errors.zip)}
                    />
                  </Field>
                  <Field label="Country" error={errors.country?.message}>
                    <input
                      {...register('country')}
                      placeholder="US"
                      className={inputCls(errors.country)}
                    />
                  </Field>
                </div>
              </div>
            </section>
          )}

          {hasServices && (
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-4">Service dates</h2>
              <div className="space-y-4">
                {serviceItems.map((item) => (
                  <ServiceDateRow
                    key={item.listing.id}
                    item={item}
                    onDateChange={setRequestedDate}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Payment */}
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Payment</h2>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <CardElement
                options={{
                  style: {
                    base: {
                      fontSize: '14px',
                      color: '#111827',
                      '::placeholder': { color: '#9ca3af' },
                    },
                    invalid: { color: '#ef4444' },
                  },
                }}
              />
            </div>
          </section>
        </div>

        {/* Right — order summary */}
        <div className="lg:col-span-2">
          <div className="bg-gray-50 rounded-2xl p-6 space-y-4 sticky top-6">
            <h2 className="text-base font-semibold text-gray-900">Order summary</h2>

            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.listing.id} className="flex justify-between text-sm">
                  <span className="text-gray-600 truncate max-w-[160px]">
                    {item.listing.title}
                    {item.listing.type === 'product' && ` × ${item.quantity}`}
                  </span>
                  <span className="text-gray-900 font-medium ml-2">
                    $
                    {(
                      Number(item.listing.price) *
                      (item.listing.type === 'product' ? item.quantity : 1)
                    ).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 pt-3 flex justify-between">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="font-semibold text-gray-900">${grandTotal.toFixed(2)}</span>
            </div>

            {conflicts.length > 0 && (
              <div className="bg-red-50 rounded-xl p-3 space-y-1">
                {conflicts.map((c, i) => (
                  <p key={i} className="text-xs text-red-700">
                    <span className="font-medium">{c.title || 'Item'}</span>: {c.reason}
                    {c.available !== undefined && ` (${c.available} available)`}
                  </p>
                ))}
              </div>
            )}

            {orderError && !conflicts.length && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{orderError}</p>
            )}

            <button
              type="submit"
              disabled={isPlacing || !stripe}
              className="w-full bg-indigo-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPlacing ? 'Processing payment…' : `Pay $${grandTotal.toFixed(2)}`}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

ServiceDateRow.propTypes = {
  item: PropTypes.shape({
    listing: PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      price: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    }).isRequired,
    requestedDate: PropTypes.string,
  }).isRequired,
  onDateChange: PropTypes.func.isRequired,
}

function ServiceDateRow({ item, onDateChange }) {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const max = new Date()
  max.setMonth(max.getMonth() + 6)
  const minStr = tomorrow.toISOString().split('T')[0]
  const maxStr = max.toISOString().split('T')[0]

  return (
    <div className="flex items-center justify-between gap-4 bg-white rounded-xl border border-gray-200 p-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{item.listing.title}</p>
        <p className="text-xs text-gray-400">${Number(item.listing.price).toFixed(2)}</p>
      </div>
      <input
        type="date"
        min={minStr}
        max={maxStr}
        value={item.requestedDate || ''}
        onChange={(e) => onDateChange(item.listing.id, e.target.value)}
        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  )
}

Field.propTypes = {
  label: PropTypes.string.isRequired,
  error: PropTypes.string,
  children: PropTypes.node.isRequired,
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

function inputCls(error) {
  return `w-full border ${error ? 'border-red-400' : 'border-gray-300'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500`
}
