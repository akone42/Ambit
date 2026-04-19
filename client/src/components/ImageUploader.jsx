/**
 * IMAGE UPLOADER
 *
 * A reusable file-picker component that:
 *   1. Shows a "Choose image" button
 *   2. When a file is picked, immediately uploads it to POST /api/upload
 *   3. Shows a preview of the image while uploading / after success
 *   4. Calls onUpload(url) with the Cloudinary CDN URL when done
 *
 * The parent component (StorefrontForm, ListingForm) stores the returned URL
 * in its own form state and includes it when submitting.
 *
 * Why upload immediately instead of with the form?
 *   - The user gets instant feedback (they see their image right away)
 *   - The form submit stays simple — it just sends a URL string, not a file
 *   - If the upload fails, we show the error before the user hits Save
 */

import PropTypes from 'prop-types'
import { useRef, useState } from 'react'
import api from '../lib/axios.js'

export default function ImageUploader({ currentUrl, onUpload, label = 'Image' }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  // previewUrl is what we show — starts as currentUrl (existing image), updates after upload
  const [previewUrl, setPreviewUrl] = useState(currentUrl ?? null)

  // useRef gives us a reference to the hidden <input type="file"> DOM element
  // so we can trigger a click on it when the user clicks our styled button.
  const inputRef = useRef(null)

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    // Show a local preview immediately using URL.createObjectURL —
    // this creates a temporary browser URL for the local file so the user
    // sees the image instantly, before the upload even starts.
    setPreviewUrl(URL.createObjectURL(file))
    setError(null)
    setUploading(true)

    try {
      // FormData is the browser's way to package a file for multipart/form-data upload.
      // The field name 'image' must match what Multer expects on the server:
      //   upload.single('image')
      const formData = new FormData()
      formData.append('image', file)

      // We can't use api.post() with JSON here — we need multipart/form-data.
      // axios detects FormData automatically and sets the right Content-Type header.
      const res = await api.post('/upload', formData)

      // The server returns { url: 'https://res.cloudinary.com/...' }
      // We tell the parent what URL to store.
      onUpload(res.data.url)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Upload failed. Try again.')
      // Reset preview to the previous image if upload fails
      setPreviewUrl(currentUrl ?? null)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>

      {/* Image preview */}
      {previewUrl && (
        <img
          src={previewUrl}
          alt="Preview"
          className="w-32 h-32 object-cover rounded-lg border border-gray-200 mb-3"
        />
      )}

      {/* Error message */}
      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      {/* Hidden native file input — triggered by the button below */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Styled button that triggers the hidden file input */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
      >
        {uploading ? 'Uploading…' : previewUrl ? 'Change image' : 'Choose image'}
      </button>
    </div>
  )
}

ImageUploader.propTypes = {
  currentUrl: PropTypes.string,
  onUpload: PropTypes.func.isRequired,
  label: PropTypes.string,
}
