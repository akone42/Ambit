/**
 * CLOUDINARY CONNECTION TEST
 *
 * Run with: node src/db/test-cloudinary.js  (from the server/ directory)
 *
 * This script:
 *   1. Creates a tiny test image as a Buffer (raw bytes) — no file on disk
 *   2. Uploads it to Cloudinary using our uploadStream helper
 *   3. Prints the resulting CDN URL
 *   4. Deletes the test image from Cloudinary so it doesn't clutter your account
 *
 * If all three steps succeed, our upload pipeline is confirmed working.
 * Any route that uploads listing images uses this exact same code path.
 */

import 'dotenv/config'
import { uploadStream, cloudinary } from '../lib/cloudinary.js'

async function testCloudinary() {
  console.log('Testing Cloudinary connection…\n')

  // ------------------------------------------------------------------
  // CREATE A MINIMAL VALID IMAGE BUFFER
  // ------------------------------------------------------------------
  // We need a real image — Cloudinary rejects random bytes.
  // A 1×1 pixel red PNG is 67 bytes. We encode it as a base64 string
  // and convert it to a Buffer (raw bytes).
  //
  // base64 is a way to represent binary data (like image bytes) as
  // plain text characters. Buffer.from(..., 'base64') converts it back
  // to the actual binary bytes that Cloudinary expects.
  const TINY_RED_PNG_BASE64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=='

  const imageBuffer = Buffer.from(TINY_RED_PNG_BASE64, 'base64')

  // ------------------------------------------------------------------
  // UPLOAD
  // ------------------------------------------------------------------
  // This calls the same uploadStream() function our listing routes will use.
  // `result` contains the full Cloudinary response including:
  //   - result.secure_url  → the HTTPS CDN URL (what we store in the DB)
  //   - result.public_id   → Cloudinary's internal ID (needed to delete later)
  //   - result.width / result.height / result.format / etc.
  let result
  try {
    result = await uploadStream(imageBuffer, {
      folder: 'ambit/test',
      public_id: 'connection-test', // fixed name so we can find and delete it
    })
  } catch (err) {
    console.error('Upload failed:', err.message)
    process.exit(1)
  }

  console.log('Upload succeeded.')
  console.log('  CDN URL:', result.secure_url)
  console.log('  Public ID:', result.public_id)
  console.log('  Format:', result.format)
  console.log('  Size:', result.bytes, 'bytes\n')

  // ------------------------------------------------------------------
  // CLEAN UP — DELETE THE TEST IMAGE
  // ------------------------------------------------------------------
  // We don't want a test image sitting in your Cloudinary account forever.
  // cloudinary.uploader.destroy() removes it by public_id.
  try {
    await cloudinary.uploader.destroy(result.public_id)
    console.log('Test image deleted from Cloudinary.')
  } catch (err) {
    // Not critical — just warn. The upload itself is what matters.
    console.warn('Could not delete test image:', err.message)
  }

  console.log('\nCloudinary connection confirmed.')
}

testCloudinary().catch((err) => {
  console.error(err)
  process.exit(1)
})
