import { pool } from '../db/pool.js'

// Order service function: createProductOrder

/*createProductOrder: Creates an order from the user's cart.
- Validates inventory for each item and rolls back if any item is out of stock.
  */
export async function createProductOrder(userId, { shippingAddress, items: bodyItems }) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    let cartItems

    if (bodyItems && bodyItems.length > 0) {
      // Optimized path when items are sent in the request body (e.g. from a storefront checkout page).
      // We still validate inventory here, but we trust the client to send accurate quantities for the items in their cart.
      const listingIds = bodyItems.map((i) => i.listing_id)

      const { rows: listings } = await client.query(
        `SELECT id AS listing_id, title, price, inventory_count, type
         FROM listings
         WHERE id = ANY($1)
         FOR UPDATE`,
        [listingIds]
      )

      // Merge client quantities with DB listing data.
      // We trust quantity from the client but validate against DB inventory below.
      const listingMap = Object.fromEntries(listings.map((l) => [l.listing_id, l]))
      cartItems = bodyItems
        .map((i) => ({ ...listingMap[i.listing_id], quantity: i.quantity }))
        .filter((i) => i.title) // drop any listing_id that doesn't exist in the DB
    } else {
      // Fallback: read from server-side cart_items table.
      // Used when items weren't sent in the body.
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

    const total = cartItems.reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0)

    // Create the order record
    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (buyer_id, order_type, status, shipping_addr, total)
       VALUES ($1, 'product', 'pending', $2, $3)
       RETURNING *`,
      [userId, JSON.stringify(shippingAddress), total]
    )
    const order = orderRows[0]

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

    // Clear server-side cart too in case anything was synced there
    await client.query(`DELETE FROM cart_items WHERE user_id = $1`, [userId])

    // Notification with cancel window info
    const { rows: storefrontRows } = await client.query(
      `SELECT s.cancel_window_hours, s.display_name
       FROM storefronts s
       JOIN listings l ON l.storefront_id = s.id
       WHERE l.id = $1
       LIMIT 1`,
      [cartItems[0].listing_id]
    )

    const cancelWindow = storefrontRows[0]?.cancel_window_hours ?? 24
    const storeName = storefrontRows[0]?.display_name ?? 'the seller'

    await client.query(
      `INSERT INTO notifications (user_id, type, title, body, order_id)
       VALUES ($1, 'order_placed', $2, $3, $4)`,
      [
        userId,
        'Order placed successfully',
        `You have ${cancelWindow} hour${cancelWindow !== 1 ? 's' : ''} to cancel your order from ${storeName}. Once ${storeName} confirms your order and begins production, cancellation will no longer be possible.`,
        order.id,
      ]
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

export async function cancelOrder(orderId, requesterId) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // Fetch the order WITH a row-level lock so two simultaneous
    // cancel requests can't both pass the checks at the same time
    const { rows: orderRows } = await client.query(
      `SELECT * FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    )

    const order = orderRows[0]

    if (!order) {
      await client.query('ROLLBACK')
      throw Object.assign(new Error('Order not found'), { status: 404 })
    }

    // 'completed' is not a valid status in this project — use 'fulfilled'
    if (order.status === 'cancelled') {
      await client.query('ROLLBACK')
      throw Object.assign(new Error('Order is already cancelled'), { status: 400 })
    }

    if (order.status === 'fulfilled') {
      await client.query('ROLLBACK')
      throw Object.assign(new Error('Fulfilled orders cannot be cancelled'), { status: 400 })
    }

    // Determine if requester is the buyer
    const isBuyer = order.buyer_id === requesterId

    // Determine if requester is a seller who owns a listing in this order
    let isSeller = false
    if (!isBuyer) {
      const { rows: sellerCheck } = await client.query(
        `SELECT 1
         FROM order_items oi
         JOIN listings l ON l.id = oi.listing_id
         JOIN storefronts s ON s.id = l.storefront_id
         WHERE oi.order_id = $1 AND s.owner_id = $2
         LIMIT 1`,
        [orderId, requesterId]
      )
      isSeller = sellerCheck.length > 0
    }

    if (!isBuyer && !isSeller) {
      await client.query('ROLLBACK')
      throw Object.assign(new Error('Not authorized to cancel this order'), { status: 403 })
    }

    //product order cancellations rules
    let cancellationReason = null
    let bookingFeeCharged = false

    if (order.order_type === 'product') {
      if (isBuyer) {
        // Fetch the seller's configured cancel window
        const { rows: sfRows } = await client.query(
          `SELECT s.cancel_window_hours
           FROM storefronts s
           JOIN listings l ON l.storefront_id = s.id
           JOIN order_items oi ON oi.listing_id = l.id
           WHERE oi.order_id = $1
           LIMIT 1`,
          [orderId]
        )

        const cancelWindowHours = sfRows[0]?.cancel_window_hours ?? 24
        const hoursSinceOrder =
          (Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60)

        // Block if the cancel window has passed
        if (hoursSinceOrder > cancelWindowHours) {
          await client.query('ROLLBACK')
          throw Object.assign(
            new Error(
              `This seller's cancellation window is ${cancelWindowHours} hour${cancelWindowHours !== 1 ? 's' : ''}. That window has passed.`
            ),
            { status: 400 }
          )
        }

        // Block if seller has already confirmed (started production)
        if (order.status === 'confirmed') {
          await client.query('ROLLBACK')
          throw Object.assign(
            new Error(
              'The seller has already started your order. Cancellation is no longer possible.'
            ),
            { status: 400 }
          )
        }

        cancellationReason = 'Cancelled by buyer'
      }

      if (isSeller) {
        cancellationReason = 'Cancelled by seller'
      }

      // Restore inventory for both buyer and seller cancellations
      const { rows: items } = await client.query(
        `SELECT listing_id, quantity FROM order_items WHERE order_id = $1`,
        [orderId]
      )

      for (const item of items) {
        await client.query(
          `UPDATE listings SET inventory_count = inventory_count + $1 WHERE id = $2`,
          [item.quantity, item.listing_id]
        )
      }
    }
    //service booking cancellations have different rules and no inventory to manage
    if (order.order_type === 'service') {
      if (isBuyer) {
        // Buyer can cancel anytime before requested_date, but fee is kept
        if (order.requested_date) {
          const requestedDate = new Date(order.requested_date)
          if (new Date() >= requestedDate) {
            await client.query('ROLLBACK')
            throw Object.assign(
              new Error('Cannot cancel a booking after the requested service date has passed.'),
              { status: 400 }
            )
          }
        }
        bookingFeeCharged = true
        cancellationReason = 'Cancelled by buyer — booking fee retained'
      }

      if (isSeller) {
        // Seller cancels — no fee, buyer gets full refund
        cancellationReason = 'Cancelled by seller — full refund issued'
      }
    }

    // Finally, update the order status to 'cancelled' and record the cancellation reason
    const { rows: updated } = await client.query(
      `UPDATE orders
       SET status               = 'cancelled',
           cancelled_at         = NOW(),
           cancellation_reason  = $1,
           booking_fee_charged  = $2
       WHERE id = $3
       RETURNING *`,
      [cancellationReason, bookingFeeCharged, orderId]
    )

    if (isBuyer) {
      // Notify the buyer that their cancellation went through
      await client.query(
        `INSERT INTO notifications (user_id, type, title, body, order_id)
         VALUES ($1, 'order_cancelled', $2, $3, $4)`,
        [
          requesterId,
          'Order cancelled',
          bookingFeeCharged
            ? 'Your booking has been cancelled. The booking fee is non-refundable.'
            : 'Your order has been cancelled and inventory has been restored.',
          orderId,
        ]
      )
    }

    if (isSeller) {
      // Notify the buyer that the seller cancelled their order
      await client.query(
        `INSERT INTO notifications (user_id, type, title, body, order_id)
         VALUES ($1, 'order_cancelled_by_seller', $2, $3, $4)`,
        [
          order.buyer_id,
          'Your order was cancelled by the seller',
          order.order_type === 'service'
            ? 'The seller has cancelled your booking. You are entitled to a full refund.'
            : 'The seller has cancelled your order. Inventory has been restored and a full refund will be issued.',
          orderId,
        ]
      )
    }

    await client.query('COMMIT')

    return updated[0]
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
