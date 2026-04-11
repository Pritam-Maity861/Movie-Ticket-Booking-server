import { z } from "zod";

export const bookingPayloadSchema = z.object({
  showtimeId: z.string().uuid("invalid showtimeId"),
  seatIds: z
    .array(z.string().uuid("invalid seatIds"))
    .min(1, "At least one seatId is required"),
});
