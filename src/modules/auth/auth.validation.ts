import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  name: z.string().min(2, 'Name must be at least 2 characters long').toLowerCase(),
  role: z.enum(["USER", "THEATER_OWNER"]).optional().default("USER"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});