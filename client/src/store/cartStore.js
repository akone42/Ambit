import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../lib/axios.js'

// Cart item shape: { listing, quantity, requestedDate }
// requestedDate is ISO date string (YYYY-MM-DD) for services, null for products.

const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      addItem: (listing, quantity = 1, requestedDate = null) => {
        const { items } = get()
        const idx = items.findIndex((i) => i.listing.id === listing.id)
        if (idx !== -1) {
          const next = [...items]
          next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity }
          set({ items: next, isOpen: true })
        } else {
          set({ items: [...items, { listing, quantity, requestedDate }], isOpen: true })
        }
      },

      removeItem: (listingId) =>
        set({ items: get().items.filter((i) => i.listing.id !== listingId) }),

      updateQuantity: (listingId, quantity) => {
        if (quantity < 1) {
          get().removeItem(listingId)
          return
        }
        set({
          items: get().items.map((i) => (i.listing.id === listingId ? { ...i, quantity } : i)),
        })
      },

      setRequestedDate: (listingId, date) =>
        set({
          items: get().items.map((i) =>
            i.listing.id === listingId ? { ...i, requestedDate: date } : i
          ),
        }),

      clearCart: () => set({ items: [] }),

      // Called after login: push local items to server, pull back merged cart.
      // If no local items, we still pull the server cart (prior session items).
      mergeGuestCart: async () => {
        const localItems = get().items
        try {
          if (localItems.length > 0) {
            const { data } = await api.post('/cart/sync', {
              items: localItems.map((i) => ({ listing_id: i.listing.id, quantity: i.quantity })),
            })
            set({
              items: data.items.map((row) => ({
                listing: rowToListing(row),
                quantity: row.quantity,
                // Preserve requestedDate from local state for services
                requestedDate:
                  localItems.find((i) => i.listing.id === row.listing_id)?.requestedDate ?? null,
              })),
            })
          } else {
            const { data } = await api.get('/cart')
            set({
              items: data.items.map((row) => ({
                listing: rowToListing(row),
                quantity: row.quantity,
                requestedDate: null,
              })),
            })
          }
        } catch {
          // Cart merge is best-effort — local state is the fallback
        }
      },
    }),
    {
      name: 'ambit-cart',
      partialize: (state) => ({ items: state.items }),
    }
  )
)

function rowToListing(row) {
  return {
    id: row.listing_id,
    title: row.title,
    price: row.price,
    type: row.type,
    image_url: row.image_url,
    inventory_count: row.inventory_count,
    delivery_window_days: row.delivery_window_days,
    storefront_name: row.storefront_name,
    storefront_slug: row.storefront_slug,
    status: row.status,
  }
}

export default useCartStore
