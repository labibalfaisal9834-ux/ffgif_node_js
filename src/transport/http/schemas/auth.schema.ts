import { z } from 'zod';

const passwordRegex = /[!@#$%^&*]/;

export const signupSchema = z
  .object({
    username: z
      .string()
      .min(4, 'username min 4 chars')
      .max(20, 'username max 20 chars')
      .regex(/^[a-zA-Z0-9]+$/, 'username must be alphanumeric'),
    fullname: z.string().min(4, 'fullname min 4 chars').max(100, 'fullname max 100 chars'),
    email: z.string().email('invalid email').max(50, 'email max 50 chars'),
    password: z
      .string()
      .min(5, 'password min 5 chars')
      .max(70, 'password max 70 chars')
      .refine((val) => passwordRegex.test(val), {
        message: 'password must contain at least one special character (!@#$%^&*)',
      }),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'confirm_password must match password',
    path: ['confirm_password'],
  });

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().email('invalid email').max(50, 'email max 50 chars'),
  password: z
    .string()
    .min(5, 'password min 5 chars')
    .max(70, 'password max 70 chars')
    .refine((val) => passwordRegex.test(val), {
      message: 'password must contain at least one special character (!@#$%^&*)',
    }),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const resendVerifySchema = z.object({
  email: z.string().email('invalid email').max(50, 'email max 50 chars'),
});

export type ResendVerifyInput = z.infer<typeof resendVerifySchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email('invalid email').max(50, 'email max 50 chars'),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'token is required').max(50, 'token max 50 chars'),
    password: z
      .string()
      .min(5, 'password min 5 chars')
      .max(70, 'password max 70 chars')
      .refine((val) => passwordRegex.test(val), {
        message: 'password must contain at least one special character (!@#$%^&*)',
      }),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'confirm_password must match password',
    path: ['confirm_password'],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
