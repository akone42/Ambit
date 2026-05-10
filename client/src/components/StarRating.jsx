/**
 * STAR RATING
 *
 * Two modes:
 *   - Display (interactive=false): shows filled/empty stars for a given value
 *   - Interactive (interactive=true): clickable stars for submitting a rating
 */

import PropTypes from 'prop-types'

export default function StarRating({ value, max = 5, interactive = false, onChange, size = 'sm' }) {
  const sizeClass = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5'

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => {
        const filled = i < Math.round(value)
        return interactive ? (
          <button
            key={i}
            type="button"
            onClick={() => onChange?.(i + 1)}
            className={`${sizeClass} transition-colors ${filled ? 'text-amber-400' : 'text-gray-300 hover:text-amber-300'}`}
            aria-label={`Rate ${i + 1} out of ${max}`}
          >
            ★
          </button>
        ) : (
          <span key={i} className={`${sizeClass} ${filled ? 'text-amber-400' : 'text-gray-300'}`}>
            ★
          </span>
        )
      })}
    </div>
  )
}

StarRating.propTypes = {
  value: PropTypes.number.isRequired,
  max: PropTypes.number,
  interactive: PropTypes.bool,
  onChange: PropTypes.func,
  size: PropTypes.oneOf(['sm', 'md']),
}
