import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { getNotifications, markRead } from '../services/notificationService.js'

const router = express.Router()

// GET /api/notifications — all notifications for the logged-in user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const notifications = await getNotifications(req.user.id)
    res.json({ notifications })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Get notifications error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/notifications/read — mark all as read
router.put('/read', authMiddleware, async (req, res) => {
  try {
    await markRead(req.user.id)
    res.json({ message: 'Marked all as read' })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Mark read error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/notifications/:id/read — mark one as read
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    await markRead(req.user.id, req.params.id)
    res.json({ message: 'Marked as read' })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Mark read error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
