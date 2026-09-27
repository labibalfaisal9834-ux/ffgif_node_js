import { z } from 'zod';

export const sendFriendRequestSchema = z.object({
  addressee_id: z.string().uuid(),
});

export type SendFriendRequestInput = z.infer<typeof sendFriendRequestSchema>;
