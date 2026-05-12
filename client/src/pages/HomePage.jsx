/**
 * HOME PAGE
 *
 * Route: /
 * Accessible to: everyone (public — no auth required)
 *
 * The main marketplace browse page. Shows all active listings and lets
 * visitors search by keyword or filter by category.
 *
 * Data flow:
 *   1. On mount, fetch GET /api/listings → show everything
 *   2. When search or category changes, re-fetch with query params
 *   3. Each result is rendered by <ListingCard>
 *
 * The server does all the filtering — we just pass query params.
 * No client-side filtering happens here.
 */

import { useEffect, useState } from 'react'
import api from '../lib/axios.js'
import ListingCard from '../components/ListingCard.jsx'

// A fixed list of categories from the seed data.
// In a later milestone this could be fetched dynamically from the DB.
const CATEGORIES = [
  'All',
  'Accessories',
  'Lessons',
  'Baked Goods',
  'Design',
  'Tutoring',
  'Woodworking',
  'Fitness',
  'Music',
]

export default function HomePage() {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // search: the text the user typed in the search box
  // activeCategory: which category button is currently selected
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')

  // inputValue is the live value of the search box.
  // We keep it separate from `search` so we only fire the API call
  // when the user submits (presses Enter or clicks the button),
  // not on every single keystroke.
  const [inputValue, setInputValue] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Fetch listings whenever search or activeCategory changes.
  // The dependency array [search, activeCategory] means this effect
  // re-runs automatically whenever either of those state values changes.
  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (activeCategory !== 'All') params.set('category', activeCategory)
    const query = params.toString()

    api
      .get(`/listings${query ? `?${query}` : ''}`)
      .then((res) => {
        const data = res.data?.listings
        // eslint-disable-next-line no-console
        if (!Array.isArray(data)) console.error('Unexpected listings response:', res.data)
        setListings(Array.isArray(data) ? data : [])
        setError(null)
        setLoading(false)
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Listings fetch error:', err)
        setError('Failed to load listings. Please try again.')
        setLoading(false)
      })
  }, [search, activeCategory])

  function handleSearchSubmit(e) {
    // e.preventDefault() stops the browser from reloading the page
    // when the form is submitted (the default HTML form behaviour).
    e.preventDefault()
    setSearch(inputValue.trim())
  }

  function handleCategoryClick(category) {
    setActiveCategory(category)
    // Also clear the search when switching category —
    // avoids confusing combinations like category=Baking + search=woodworking
    setSearch('')
    setInputValue('')
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* ── Hero / Search bar ── */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Find skills and goods from your community
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          Browse handmade products, tutoring, design work, and more.
        </p>

        {/* Search form — pressing Enter triggers handleSearchSubmit */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-lg mx-auto">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search listings…"
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700"
          >
            Search
          </button>
        </form>
      </div>

      {/* ── Category filter pills ── */}
      {/* Mobile: toggle button */}
      <div className="sm:hidden mb-3">
        <button
          onClick={() => setFiltersOpen((o) => !o)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg px-3 py-2 bg-white hover:border-indigo-400 transition-colors w-full justify-between"
        >
          <span>
            Filter by category
            {activeCategory !== 'All' && (
              <span className="ml-2 text-indigo-600">· {activeCategory}</span>
            )}
          </span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Pills: always visible on sm+, toggled on mobile */}
      <div className={`flex flex-wrap gap-2 mb-6 ${filtersOpen ? 'flex' : 'hidden'} sm:flex`}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => {
              handleCategoryClick(cat)
              setFiltersOpen(false)
            }}
            className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
              activeCategory === cat
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Active filter display ── */}
      {(search || activeCategory !== 'All') && (
        <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
          <span>Showing results for:</span>
          {activeCategory !== 'All' && (
            <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
              {activeCategory}
            </span>
          )}
          {search && (
            <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
              &ldquo;{search}&rdquo;
            </span>
          )}
          <button
            onClick={() => {
              setSearch('')
              setInputValue('')
              setActiveCategory('All')
            }}
            className="text-indigo-500 hover:underline ml-1"
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Listings grid ── */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading listings…</div>
      ) : error ? (
        <div className="text-center py-16 text-red-500">{error}</div>
      ) : listings.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-1">No listings found.</p>
          <p className="text-sm">Try a different search or category.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-4">
            {listings.length} listing{listings.length !== 1 ? 's' : ''} found
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
