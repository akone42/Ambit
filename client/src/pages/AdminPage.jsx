/**
 * ADMIN DASHBOARD
 *
 * Route: /admin
 * Accessible to: admins only (requireRole enforced on every API call server-side)
 *
 * Three tabs:
 *   Users    — view all users, change roles
 *   Listings — view all listings (any status), moderate (pause/restore/delete)
 *   Orders   — view all orders, update status
 */

import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import api from '../lib/axios.js'

// ── Reusable status badge ─────────────────────────────────────────────────────
function Badge({ label, color }) {
  const colors = {
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-600',
    yellow: 'bg-amber-100 text-amber-700',
    indigo: 'bg-indigo-100 text-indigo-700',
    gray: 'bg-gray-100 text-gray-500',
  }
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[color] ?? colors.gray}`}
    >
      {label}
    </span>
  )
}

Badge.propTypes = {
  label: PropTypes.string.isRequired,
  color: PropTypes.string,
}

function roleBadge(role) {
  const map = { admin: 'red', seller: 'indigo', buyer: 'gray' }
  return <Badge label={role} color={map[role] ?? 'gray'} />
}

function statusBadge(status) {
  const map = {
    active: 'green',
    confirmed: 'green',
    fulfilled: 'green',
    paused: 'yellow',
    pending: 'yellow',
    shipped: 'indigo',
    deleted: 'red',
    cancelled: 'red',
  }
  return <Badge label={status} color={map[status] ?? 'gray'} />
}

// ── USERS TAB ─────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null) // id of the row being updated

  useEffect(() => {
    api.get('/admin/users').then((r) => {
      setUsers(r.data.users)
      setLoading(false)
    })
  }, [])

  async function changeRole(userId, role) {
    setUpdating(userId)
    try {
      const { data } = await api.put(`/admin/users/${userId}/role`, { role })
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: data.user.role } : u)))
    } finally {
      setUpdating(null)
    }
  }

  if (loading) return <p className="text-sm text-gray-400 p-4">Loading users…</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="py-3 pr-4">Username</th>
            <th className="py-3 pr-4">Email</th>
            <th className="py-3 pr-4">Role</th>
            <th className="py-3 pr-4">Storefront</th>
            <th className="py-3 pr-4">Joined</th>
            <th className="py-3">Change role</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-gray-50">
              <td className="py-3 pr-4 font-medium text-gray-800">{u.username}</td>
              <td className="py-3 pr-4 text-gray-500">{u.email}</td>
              <td className="py-3 pr-4">{roleBadge(u.role)}</td>
              <td className="py-3 pr-4 text-gray-500">
                {u.storefront_slug ? (
                  <a
                    href={`/shop/${u.storefront_slug}`}
                    className="text-indigo-600 hover:underline"
                  >
                    {u.storefront_name}
                  </a>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className="py-3 pr-4 text-gray-400">
                {new Date(u.created_at).toLocaleDateString()}
              </td>
              <td className="py-3">
                <select
                  value={u.role}
                  disabled={updating === u.id}
                  onChange={(e) => changeRole(u.id, e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <option value="buyer">buyer</option>
                  <option value="seller">seller</option>
                  <option value="admin">admin</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── LISTINGS TAB ──────────────────────────────────────────────────────────────
function ListingsTab() {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)

  useEffect(() => {
    api.get('/admin/listings').then((r) => {
      setListings(r.data.listings)
      setLoading(false)
    })
  }, [])

  async function changeStatus(listingId, status) {
    setUpdating(listingId)
    try {
      const { data } = await api.put(`/admin/listings/${listingId}/status`, { status })
      setListings((prev) =>
        prev.map((l) => (l.id === listingId ? { ...l, status: data.listing.status } : l))
      )
    } finally {
      setUpdating(null)
    }
  }

  if (loading) return <p className="text-sm text-gray-400 p-4">Loading listings…</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="py-3 pr-4">Title</th>
            <th className="py-3 pr-4">Type</th>
            <th className="py-3 pr-4">Price</th>
            <th className="py-3 pr-4">Seller</th>
            <th className="py-3 pr-4">Status</th>
            <th className="py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {listings.map((l) => (
            <tr key={l.id} className="hover:bg-gray-50">
              <td className="py-3 pr-4 font-medium text-gray-800 max-w-[200px] truncate">
                {l.title}
              </td>
              <td className="py-3 pr-4">
                <Badge label={l.type} color={l.type === 'service' ? 'indigo' : 'green'} />
              </td>
              <td className="py-3 pr-4 text-gray-600">${Number(l.price).toFixed(2)}</td>
              <td className="py-3 pr-4 text-gray-500">{l.seller_username}</td>
              <td className="py-3 pr-4">{statusBadge(l.status)}</td>
              <td className="py-3 flex gap-2 flex-wrap">
                {l.status !== 'active' && (
                  <button
                    onClick={() => changeStatus(l.id, 'active')}
                    disabled={updating === l.id}
                    className="text-xs px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    Restore
                  </button>
                )}
                {l.status === 'active' && (
                  <button
                    onClick={() => changeStatus(l.id, 'paused')}
                    disabled={updating === l.id}
                    className="text-xs px-2 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                  >
                    Pause
                  </button>
                )}
                {l.status !== 'deleted' && (
                  <button
                    onClick={() => changeStatus(l.id, 'deleted')}
                    disabled={updating === l.id}
                    className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── ORDERS TAB ────────────────────────────────────────────────────────────────
function OrdersTab() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)

  useEffect(() => {
    api.get('/admin/orders').then((r) => {
      setOrders(r.data.orders)
      setLoading(false)
    })
  }, [])

  async function changeStatus(orderId, status) {
    setUpdating(orderId)
    try {
      const { data } = await api.put(`/admin/orders/${orderId}/status`, { status })
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: data.order.status } : o))
      )
    } finally {
      setUpdating(null)
    }
  }

  if (loading) return <p className="text-sm text-gray-400 p-4">Loading orders…</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="py-3 pr-4">Order ID</th>
            <th className="py-3 pr-4">Buyer</th>
            <th className="py-3 pr-4">Type</th>
            <th className="py-3 pr-4">Total</th>
            <th className="py-3 pr-4">Status</th>
            <th className="py-3 pr-4">Date</th>
            <th className="py-3">Update status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {orders.map((o) => (
            <tr key={o.id} className="hover:bg-gray-50">
              <td className="py-3 pr-4 font-mono text-xs text-gray-400">{o.id.slice(0, 8)}…</td>
              <td className="py-3 pr-4 text-gray-700">{o.buyer_username}</td>
              <td className="py-3 pr-4">
                <Badge
                  label={o.order_type}
                  color={o.order_type === 'service' ? 'indigo' : 'green'}
                />
              </td>
              <td className="py-3 pr-4 text-gray-600">${Number(o.total).toFixed(2)}</td>
              <td className="py-3 pr-4">{statusBadge(o.status)}</td>
              <td className="py-3 pr-4 text-gray-400">
                {new Date(o.created_at).toLocaleDateString()}
              </td>
              <td className="py-3">
                <select
                  value={o.status}
                  disabled={updating === o.id}
                  onChange={(e) => changeStatus(o.id, e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <option value="pending">pending</option>
                  <option value="confirmed">confirmed</option>
                  <option value="shipped">shipped</option>
                  <option value="fulfilled">fulfilled</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
const TABS = ['Users', 'Listings', 'Orders']

export default function AdminPage() {
  const [tab, setTab] = useState('Users')

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Manage users, listings, and orders.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        {tab === 'Users' && <UsersTab />}
        {tab === 'Listings' && <ListingsTab />}
        {tab === 'Orders' && <OrdersTab />}
      </div>
    </div>
  )
}
