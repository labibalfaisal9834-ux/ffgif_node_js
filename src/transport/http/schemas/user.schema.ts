import { z } from 'zod';

const passwordRegex = /[!@#$%^&*]/;

export const updateProfileSchema = z.object({
  avatar_url: z.string().optional(),
  username: z.string().min(4).max(20).regex(/^[a-zA-Z0-9]+$/).optional(),
  fullname: z.string().min(4).max(100).optional(),
  email: z.string().email().max(50).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(5).max(70),
    password: z
      .string()
      .min(5)
      .max(70)
      .refine((val) => passwordRegex.test(val), {
        message: 'password must contain at least one special character (!@#$%^&*)',
      }),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'confirm_password must match password',
    path: ['confirm_password'],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const deleteUserSchema = z.object({
  password: z
    .string()
    .min(5)
    .max(70)
    .refine((val) => passwordRegex.test(val), {
      message: 'password must contain at least one special character (!@#$%^&*)',
    }),
});

export type DeleteUserInput = z.infer<typeof deleteUserSchema>;
