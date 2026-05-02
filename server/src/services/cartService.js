import { pool } from '../db/pool.js'

// Cart service functions: getCart, addItem, updateItem, removeItem, mergeGuestCart
//getCart: Fetches all cart items for a user, including listing details and storefront info.
export async function getCart(userId) {
  const { rows } = await pool.query(
    `SELECT 
       ci.id, ci.quantity, ci.listing_id,
       l.title, l.price, l.image_url, l.type, l.inventory_count, l.status,
       s.display_name AS storefront_name, s.slug AS storefront_slug
     FROM cart_items ci
     JOIN listings l ON l.id = ci.listing_id
     JOIN storefronts s ON s.id = l.storefront_id
     WHERE ci.user_id = $1`,
    [userId]
  )
  return rows
}

//addItem: Adds a listing to the cart or updates quantity if it already exists. Validates listing status and inventory.
export async function addItem(userId, listingId, quantity) {
  // Verify listing exists, is active, is a product, and has enough stock
  const { rows: listings } = await pool.query(
    `SELECT id, type, status, inventory_count FROM listings WHERE id = $1`,
    [listingId]
  )
  const listing = listings[0]
  if (!listing) throw Object.assign(new Error('Listing not found'), { status: 404 })
  if (listing.type !== 'product')
    throw Object.assign(new Error('Only products can be added to cart'), { status: 400 })
  if (listing.status !== 'active')
    throw Object.assign(new Error('Listing is not available'), { status: 400 })
  if (listing.inventory_count < quantity)
    throw Object.assign(new Error('Not enough inventory'), { status: 400 })

  // Insert or bump quantity if already in cart
  const { rows } = await pool.query(
    `INSERT INTO cart_items (user_id, listing_id, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, listing_id)
     DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity
     RETURNING *`,
    [userId, listingId, quantity]
  )
  return rows[0]
}

//updateItem: Updates the quantity of a specific cart item. Returns the updated item or null if not found.
export async function updateItem(userId, listingId, quantity) {
  const { rows } = await pool.query(
    `UPDATE cart_items SET quantity = $1
     WHERE user_id = $2 AND listing_id = $3
     RETURNING *`,
    [quantity, userId, listingId]
  )
  return rows[0] || null
}

//removeItem: Deletes a specific item from the cart based on user and listing ID.
export async function removeItem(userId, listingId) {
  await pool.query(`DELETE FROM cart_items WHERE user_id = $1 AND listing_id = $2`, [
    userId,
    listingId,
  ])
}

//mergeGuestCart: Merges a guest cart into the user's cart upon login. Validates listings and uses the higher quantity on conflicts.
export async function mergeGuestCart(userId, guestCart) {
  for (const { listingId, quantity } of guestCart) {
    const { rows: listings } = await pool.query(
      `SELECT id, type, status FROM listings WHERE id = $1`,
      [listingId]
    )
    const listing = listings[0]
    if (!listing || listing.status !== 'active' || listing.type !== 'product') continue

    // Higher quantity wins on conflict
    await pool.query(
      `INSERT INTO cart_items (user_id, listing_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, listing_id)
       DO UPDATE SET quantity = GREATEST(cart_items.quantity, EXCLUDED.quantity)`,
      [userId, listingId, quantity]
    )
  }
}
