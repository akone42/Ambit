/**
 * CLOUDINARY CONFIG
 *
 * This file configures the Cloudinary SDK with our credentials and exports
 * two things:
 *   1. `cloudinary` — the configured client (used for deleting images etc.)
 *   2. `uploadStream` — a helper that wraps Cloudinary's stream-based upload
 *      in a Promise so we can use async/await with it.
 *
 * Why a separate file?
 * Configuration should happen once. If we called cloudinary.config() in every
 * route that needs uploads, we'd repeat ourselves and risk inconsistency.
 * Centralizing it here means every part of the app imports from one place.
 */

import { v2 as cloudinary } from 'cloudinary'

// cloudinary.config() reads our credentials and stores them internally.
// After this runs, every cloudinary API call in this process is authenticated.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

/**
 * uploadStream(buffer, options)
 *
 * The problem: Cloudinary's upload_stream uses Node.js "streams" and
 * callbacks — an older async pattern. Our routes use async/await.
 * These two patterns don't mix directly, so we wrap the stream in a
 * Promise to bridge them.
 *
 * A "stream" is a way to process data in chunks instead of all at once.
 * Think of it like a garden hose — water (data) flows through continuously
 * rather than filling a bucket first and dumping it all at once.
 * This is important for large files: we never hold the entire image in
 * memory longer than needed.
 *
 * A "buffer" is a chunk of raw bytes already in memory — in our case,
 * Multer (the file upload middleware) gives us the image as a Buffer.
 * We pipe that buffer into the Cloudinary stream.
 *
 * @param {Buffer} buffer - the image bytes from Multer
 * @param {object} options - Cloudinary upload options (folder, transformation, etc.)
 * @returns {Promise<object>} - resolves with the Cloudinary upload result,
 *                              which includes `secure_url` — the CDN URL we store
 */
export function uploadStream(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    // upload_stream returns a writable stream. Cloudinary reads from it,
    // uploads the data, then calls our callback when done.
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'ambit', ...options },
      (error, result) => {
        // This callback fires when the upload finishes (success or failure).
        // We resolve/reject the Promise accordingly so the caller can
        // use try/catch and async/await as normal.
        if (error) return reject(error)
        resolve(result)
      }
    )

    // stream.end(buffer) writes the entire buffer into the stream and
    // signals that there's no more data. Cloudinary then processes and
    // uploads everything it received.
    stream.end(buffer)
  })
}

export { cloudinary }
