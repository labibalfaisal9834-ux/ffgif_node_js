import { z } from 'zod';

export const createShareSchema = z.object({
  shared_with: z.string().email(),
  expire_at: z.string().datetime(),
});

export type CreateShareInput = z.infer<typeof createShareSchema>;

export const createShareByTokenSchema = z.object({
  gif_key: z.string().min(1),
  email: z.string().email(),
  expire_at: z.string().datetime(),
});

export type CreateShareByTokenInput = z.infer<typeof createShareByTokenSchema>;
