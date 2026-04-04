import { z } from "zod";

export const createShowtimeSchema = z.object({
  movieId: z.string().uuid("Invalid movieId"),

  screenId: z.string().uuid("Invalid screenId"),

  startTime: z
    .string()
    .datetime("Invalid startTime format") // ISO string from frontend
    .transform((val) => new Date(val)),
  vipSeatPrice: z.number().positive("VIP price must be greater than 0"),

  regularSeatPrice: z
    .number()
    .positive("Regular price must be greater than 0"),

  premiumSeatPrice: z
    .number()
    .positive("Premium price must be greater than 0"),
});

export type CreateShowtimeInput = z.infer<typeof createShowtimeSchema>;
