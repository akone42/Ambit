import { z } from 'zod'

export const ShippingAddressSchema = z.object({
  street: z.string().min(1, 'Required'),
  city: z.string().min(1, 'Required'),
  state: z.string().min(1, 'Required'),
  zip: z.string().min(1, 'Required'),
  country: z.string().min(1, 'Required'),
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
