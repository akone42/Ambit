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
