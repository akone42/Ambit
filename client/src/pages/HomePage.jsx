import { useEffect, useState } from 'react'
import api from '../lib/axios.js'
import ListingCard from '../components/ListingCard.jsx'

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
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [inputValue, setInputValue] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

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
    e.preventDefault()
    setSearch(inputValue.trim())
  }

  function handleCategoryClick(category) {
    setActiveCategory(category)
    setSearch('')
    setInputValue('')
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* ── Hero / Search bar ── */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Find skills and goods from your community
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          Browse handmade products, tutoring, design work, and more.
        </p>

        <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-lg mx-auto">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search listings…"
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
      <div className="sm:hidden mb-3">
        <button
          onClick={() => setFiltersOpen((o) => !o)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 hover:border-indigo-400 transition-colors w-full justify-between"
        >
          <span>
            Filter by category
            {activeCategory !== 'All' && (
              <span className="ml-2 text-indigo-600 dark:text-indigo-400">· {activeCategory}</span>
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
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-indigo-400'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Active filter display ── */}
      {(search || activeCategory !== 'All') && (
        <div className="flex items-center gap-2 mb-4 text-sm text-gray-500 dark:text-gray-400">
          <span>Showing results for:</span>
          {activeCategory !== 'All' && (
            <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">
              {activeCategory}
            </span>
          )}
          {search && (
            <span className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">
              &ldquo;{search}&rdquo;
            </span>
          )}
          <button
            onClick={() => {
              setSearch('')
              setInputValue('')
              setActiveCategory('All')
            }}
            className="text-indigo-500 dark:text-indigo-400 hover:underline ml-1"
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Listings grid ── */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">Loading listings…</div>
      ) : error ? (
        <div className="text-center py-16 text-red-500">{error}</div>
      ) : listings.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <p className="text-lg mb-1">No listings found.</p>
          <p className="text-sm">Try a different search or category.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
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
