import { z } from 'zod'

const BaseListingSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(2000),
  price: z.number().positive(),
  category: z.string().min(1),
})

export const ServiceListingSchema = BaseListingSchema.extend({
  type: z.literal('service'),
  delivery_window_days: z.number().int().positive(),
  inventory_count: z.undefined(),
})

export const ProductListingSchema = BaseListingSchema.extend({
  type: z.literal('product'),
  inventory_count: z.number().int().nonnegative(),
  delivery_window_days: z.undefined(),
})

// discriminated union — Zod picks the right schema based on `type`
export const ListingSchema = z.discriminatedUnion('type', [
  ServiceListingSchema,
  ProductListingSchema,
])

// For PUT (update) requests — every field is optional except we still
// validate whatever IS provided. We can't partial() a discriminated union,
// so we use a flat optional schema for updates.
export const UpdateListingSchema = z.object({
  title: z.string().min(3).max(120).optional(),
  description: z.string().min(10).max(2000).optional(),
  price: z.number().positive().optional(),
  category: z.string().min(1).optional(),
  inventory_count: z.number().int().nonnegative().optional(),
  delivery_window_days: z.number().int().positive().optional(),
  status: z.enum(['active', 'paused']).optional(),
  image_url: z.string().url().optional(),
})
