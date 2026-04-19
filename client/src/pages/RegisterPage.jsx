/**
 * REGISTER PAGE
 *
 * Route: /register
 * Accessible to: unauthenticated users only (redirects logged-in users to /)
 *
 * Form fields: email, username, password
 * Validation: Zod RegisterSchema (the same schema the server uses)
 * On success: user is logged in and redirected to the homepage
 *
 * react-hook-form + zodResolver explained:
 *   useForm({ resolver: zodResolver(RegisterSchema) })
 *   → connects our Zod schema to the form
 *   → register('email') connects the <input> to the form state
 *   → handleSubmit(onSubmit) only calls onSubmit if all fields pass Zod validation
 *   → errors.email?.message contains the Zod error message for that field
 */

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { RegisterSchema } from '@ambit/shared'
import { useAuth } from '../context/AuthContext.jsx'

export default function RegisterPage() {
  const { user, register: registerUser } = useAuth()
  const navigate = useNavigate()

  // If the user is already logged in, send them to the homepage.
  // useEffect watches [user] — runs whenever user changes.
  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  // useForm sets up the form.
  // resolver: zodResolver(RegisterSchema) means:
  //   "use our Zod schema to validate before calling onSubmit"
  const {
    register, // function: connect an <input> to the form
    handleSubmit, // function: wraps onSubmit with validation
    setError, // function: manually set a field error (used for server errors)
    formState: { errors, isSubmitting }, // errors: field errors, isSubmitting: true while awaiting
  } = useForm({ resolver: zodResolver(RegisterSchema) })

  async function onSubmit(data) {
    // data is { email, username, password } — already validated by Zod
    try {
      await registerUser(data.email, data.username, data.password)
      // registerUser sets user in AuthContext → useEffect above fires → navigate('/')
    } catch (err) {
      // err.response.data is the JSON body the server sent back
      const serverErrors = err.response?.data?.errors

      if (serverErrors) {
        // Map server field errors back onto the form inputs
        // so they appear under the right input, same as client-side errors
        Object.entries(serverErrors).forEach(([field, messages]) => {
          setError(field, { message: messages[0] })
        })
      } else {
        // Non-field error (e.g. 500) — set it on a synthetic 'root' field
        setError('root', { message: err.response?.data?.error || 'Something went wrong' })
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Create your account</h1>
        <p className="text-gray-500 text-sm mb-8">
          Already have one?{' '}
          <Link to="/login" className="text-indigo-600 hover:underline">
            Sign in
          </Link>
        </p>

        {/* handleSubmit(onSubmit) validates first, then calls onSubmit */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Root error (non-field server errors like 500) */}
          {errors.root && (
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{errors.root.message}</p>
          )}

          {/* EMAIL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            {/* register('email') connects this input to the form.
                It injects: name, ref, onChange, onBlur */}
            <input
              type="email"
              {...register('email')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="you@example.com"
            />
            {/* errors.email is set either by Zod (client) or setError (server) */}
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>

          {/* USERNAME */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              {...register('username')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="yourhandle"
            />
            {errors.username && (
              <p className="text-xs text-red-500 mt-1">{errors.username.message}</p>
            )}
          </div>

          {/* PASSWORD */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              {...register('password')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="At least 8 characters"
            />
            {errors.password && (
              <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
            )}
          </div>

          {/* SUBMIT */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {/* isSubmitting is true while the async onSubmit is running */}
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}
