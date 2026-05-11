import { pool } from '../db/pool.js'

// Order service function: createProductOrder

/*createProductOrder: Creates an order from the user's cart.
 Validates inventory with row-level locks to prevent race conditions
  and returns detailed conflict info if inventory is insufficient.
  */
// items (optional): array of { listing_id, quantity } from the client's local cart.
// If provided, we look up only those listings from the DB (skipping the server-side
// cart_items table). If omitted, we fall back to reading the DB cart — this keeps
// backward compatibility with any flow that syncs items to the server first.
export async function createProductOrder(userId, { shippingAddress, items: bodyItems }) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    let cartItems

    if (bodyItems && bodyItems.length > 0) {
      // Client sent items directly — look them up from listings with a lock
      const listingIds = bodyItems.map((i) => i.listing_id)
      const { rows: listings } = await client.query(
        `SELECT id AS listing_id, title, price, inventory_count, type
         FROM listings
         WHERE id = ANY($1)
         FOR UPDATE`,
        [listingIds]
      )

      // Merge the quantities from the client with the listing data from the DB
      const listingMap = Object.fromEntries(listings.map((l) => [l.listing_id, l]))
      cartItems = bodyItems
        .map((i) => ({ ...listingMap[i.listing_id], quantity: i.quantity }))
        .filter((i) => i.title) // drop any listing_id that wasn't found
    } else {
      // Fall back to the server-side cart_items table
      const { rows } = await client.query(
        `SELECT
           ci.listing_id, ci.quantity,
           l.title, l.price, l.inventory_count, l.type
         FROM cart_items ci
         JOIN listings l ON l.id = ci.listing_id
         WHERE ci.user_id = $1
         FOR UPDATE OF l`,
        [userId]
      )
      cartItems = rows
    }

    if (cartItems.length === 0) {
      await client.query('ROLLBACK')
      throw Object.assign(new Error('Cart is empty'), { status: 400 })
    }

    // Check inventory for every item before committing anything
    const conflicts = []
    for (const item of cartItems) {
      if (item.type === 'product' && item.inventory_count < item.quantity) {
        conflicts.push({
          listingId: item.listing_id,
          title: item.title,
          requested: item.quantity,
          available: item.inventory_count,
        })
      }
    }

    if (conflicts.length > 0) {
      await client.query('ROLLBACK')
      const err = new Error('Inventory conflict')
      err.status = 409
      err.conflicts = conflicts
      throw err
    }

    // Calculate total
    const total = cartItems.reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0)

    // Create the order
    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (buyer_id, order_type, status, shipping_addr, total)
       VALUES ($1, 'product', 'pending', $2, $3)
       RETURNING *`,
      [userId, JSON.stringify(shippingAddress), total]
    )
    const order = orderRows[0]

    // Create order items and decrement inventory
    for (const item of cartItems) {
      await client.query(
        `INSERT INTO order_items (order_id, listing_id, quantity, price_at_purchase)
         VALUES ($1, $2, $3, $4)`,
        [order.id, item.listing_id, item.quantity, item.price]
      )

      await client.query(
        `UPDATE listings SET inventory_count = inventory_count - $1 WHERE id = $2`,
        [item.quantity, item.listing_id]
      )
    }

    // Clear the cart
    await client.query(`DELETE FROM cart_items WHERE user_id = $1`, [userId])

    await client.query('COMMIT')
    return order
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
