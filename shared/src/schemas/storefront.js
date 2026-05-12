import { z } from 'zod'

export const StorefrontSchema = z.object({
  display_name: z.string().min(2).max(60),
  slug: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens'),
  bio: z.string().max(500).optional(),
  avatar_url: z.string().url().optional(),
  cancel_window_hours: z.number().int().min(1).max(168).optional(),
})
