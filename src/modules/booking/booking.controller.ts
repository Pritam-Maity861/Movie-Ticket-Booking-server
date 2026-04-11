import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { ApiError } from "../../utils/api-error";
import { bookingPayloadSchema } from "./booking.validation";
import { BookingService } from "./booking.service";
import { ApiResponse } from "../../utils/api-response";

export const pendingBooking = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    if (!userId) {
      throw new ApiError(401, "User not authenticated");
    }
    const parsedData = bookingPayloadSchema.safeParse(req.body);
    if (!parsedData.success) {
      throw new ApiError(400, parsedData.error.message);
    }
    const { showtimeId, seatIds } = parsedData.data;
    console.log(req.body);
    const result = await BookingService.createPendingBooking(
      userId,
      showtimeId,
      seatIds,
    );
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          result,
          "Booking done! waitinfg for payment confirmation",
        ),
      );
  },
);

export const getMyBookings = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;

    if (!userId) {
      throw new ApiError(401, "User not authenticated");
    }

    const bookings = await BookingService.getUserBookings(userId);
    res
      .status(200)
      .json(new ApiResponse(200, bookings, "Bookings fetched successfully"));
  },
);

export const getBooking = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const booking = await BookingService.getBookingById(id as string);
  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }
  res
    .status(200)
    .json(new ApiResponse(200, booking, "Booking fetched successfully"));
});
