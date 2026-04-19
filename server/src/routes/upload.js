/**
 * UPLOAD ROUTE
 *
 * POST /api/upload  — upload an image to Cloudinary, return the CDN URL
 *
 * Why a dedicated upload endpoint (instead of embedding upload in each route)?
 * Separating upload from data submission lets the client show a preview
 * immediately after the user picks a file, before they hit "Save".
 * It also keeps routes like POST /listings simple — they just receive a URL string,
 * not a file. One upload endpoint serves all resource types.
 *
 * Flow:
 *   1. Client sends a multipart/form-data POST with a field called "image"
 *   2. Multer parses the file and puts it in req.file as a Buffer
 *   3. We pipe the buffer to Cloudinary via uploadStream()
 *   4. Cloudinary stores the image and returns a secure CDN URL
 *   5. We return { url } to the client
 */

import express from 'express'
import multer from 'multer'
import { uploadStream } from '../lib/cloudinary.js'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()

// ---------------------------------------------------------------------------
// Multer configuration
// ---------------------------------------------------------------------------
// Multer is middleware that parses multipart/form-data (the format browsers use
// for file uploads). Without it, req.body would be empty and req.file undefined.
//
// memoryStorage() stores the uploaded file as a Buffer in memory (req.file.buffer)
// rather than writing it to disk. This is fine for images — we never need the
// file on disk because we immediately stream it to Cloudinary.
const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max — Cloudinary free tier has limits
  },

  // fileFilter runs before the file is accepted.
  // We only allow image types — reject PDFs, executables, etc.
  fileFilter(_req, file, callback) {
    if (file.mimetype.startsWith('image/')) {
      callback(null, true) // accept
    } else {
      callback(new Error('Only image files are allowed'), false) // reject
    }
  },
})

// ---------------------------------------------------------------------------
// POST /api/upload
// ---------------------------------------------------------------------------
// Middleware chain: authMiddleware → upload.single('image') → handler
//
// upload.single('image') means: "parse the multipart body and extract
// one file from the field named 'image'". After it runs, req.file is
// available with: { buffer, mimetype, originalname, size, ... }
router.post('/', authMiddleware, upload.single('image'), async (req, res) => {
  // If fileFilter rejected the file or no file was sent at all
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' })
  }

  try {
    // uploadStream() takes the raw image bytes and sends them to Cloudinary.
    // We pass the mimetype as a resource_type hint so Cloudinary handles
    // formats like PNG, JPEG, WebP correctly.
    const result = await uploadStream(req.file.buffer, {
      resource_type: 'image',
      // Cloudinary can auto-optimize and resize on the fly — but we keep
      // it simple here and just store the original.
    })

    // result.secure_url is the HTTPS CDN URL for the uploaded image.
    // This is what we store in the database (as image_url or avatar_url).
    res.json({ url: result.secure_url })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Upload error:', err)
    res.status(500).json({ error: 'Upload failed' })
  }
})

export default router
