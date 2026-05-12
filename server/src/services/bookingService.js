import { pool } from '../db/pool.js'

/*createServiceBooking: Creates an order for a service listing
  Requires authentication. Validates that the listing exists,
  is active, and is of type 'service' before creating the order.
*/
export async function createServiceBooking(userId, { listingId, requestedDate }) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // fetch the listing and then validate it
    const { rows: listings } = await client.query(
      `SELECT id, title, price, type, status
       FROM listings
       WHERE id = $1`,
      [listingId]
    )

    const listing = listings[0]

    // Check listing exists
    if (!listing) {
      await client.query('ROLLBACK')
      throw Object.assign(new Error('Listing not found'), { status: 404 })
    }

    // Check its actually a service
    if (listing.type !== 'service') {
      await client.query('ROLLBACK')
      throw Object.assign(new Error('Listing is not a service'), { status: 400 })
    }

    // Check if it's active
    if (listing.status !== 'active') {
      await client.query('ROLLBACK')
      throw Object.assign(new Error('Listing is not available'), { status: 400 })
    }

    // Create the order
    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (buyer_id, order_type, status, total, requested_date)
       VALUES ($1, 'service', 'pending', $2, $3)
       RETURNING *`,
      [userId, listing.price, requestedDate]
    )
    const order = orderRows[0]

    // Create the single order item with price snapshot
    await client.query(
      `INSERT INTO order_items (order_id, listing_id, quantity, price_at_purchase)
       VALUES ($1, $2, 1, $3)`,
      [order.id, listingId, listing.price]
    )

    await client.query('COMMIT')
    return order
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
