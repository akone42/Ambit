import { pool } from '../db/pool.js'

// createNotification — inserts a notification for a user.
// type: a short machine-readable string (e.g. 'order_placed', 'cancellation_blocked')
// Used internally by other services — never called directly from routes.
export async function createNotification(client, { userId, type, title, body, orderId }) {
  await client.query(
    `INSERT INTO notifications (user_id, type, title, body, order_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, type, title, body ?? null, orderId ?? null]
  )
}

// getNotifications — fetches all notifications for a user, newest first.
// Unread ones come first within that ordering.
export async function getNotifications(userId) {
  const { rows } = await pool.query(
    `SELECT * FROM notifications
     WHERE user_id = $1
     ORDER BY read ASC, created_at DESC
     LIMIT 50`,
    [userId]
  )
  return rows
}

// markRead — marks one or all notifications as read for a user.
export async function markRead(userId, notificationId = null) {
  if (notificationId) {
    await pool.query(`UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2`, [
      notificationId,
      userId,
    ])
  } else {
    await pool.query(`UPDATE notifications SET read = true WHERE user_id = $1`, [userId])
  }
}
