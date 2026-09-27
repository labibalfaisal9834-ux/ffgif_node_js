import { z } from 'zod';

export const uploadMediaSchema = z.object({
  filename: z.string().min(1, 'filename is required'),
});

export type UploadMediaInput = z.infer<typeof uploadMediaSchema>;

export const convertMediaSchema = z.object({
  upload_key: z.string().min(1, 'upload_key is required'),
  start_time: z.coerce.number().min(0, 'start_time must be >= 0'),
  end_time: z.coerce.number().min(0, 'end_time must be >= 0'),
  width: z.coerce.number().min(1).default(480),
  fps: z.coerce.number().min(1).max(60).default(15),
  loop: z.boolean().default(true),
});

export type ConvertMediaInput = z.infer<typeof convertMediaSchema>;

export const updateGifSchema = z.object({
  name: z.string().optional(),
  status: z.string().optional(),
  persist: z.boolean().optional(),
  is_public: z.boolean().optional(),
});

export type UpdateGifInput = z.infer<typeof updateGifSchema>;
