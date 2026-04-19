import { z } from 'zod'

const ShippingAddressSchema = z.object({
  street: z.string(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  country: z.string(),
})

export const OrderSchema = z.object({
  shipping_address: ShippingAddressSchema,
  items: z
    .array(
      z.object({
        listing_id: z.string().uuid(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
})

export const BookingSchema = z.object({
  listing_id: z.string().uuid(),
  requested_date: z.string().date(),
})
