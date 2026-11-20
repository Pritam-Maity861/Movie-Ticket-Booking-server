import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { ApiError } from "../../utils/api-error";
import { bookingPayloadSchema } from "./booking.validation";
import { BookingService } from "./booking.service";
import { ApiResponse } from "../../utils/api-response";
import { redis } from "../../config/redis";

// create pending booking (before payment confirmation)
export const pendingBooking = asyncHandler(
  async (req: Request, res: Response) => {
    const authUser = req.user;
    if (!authUser?.userId) {
      throw new ApiError(401, "User not authenticated", [], "UNAUTHORIZED");
    }

    const idempotencyKey = (req.headers["idempotency-key"] ||
      req.headers["x-idempotency-key"]) as string | undefined;

    if (idempotencyKey) {
      try {
        const cachedResponse = await redis.get(
          `idempotency:booking:${idempotencyKey}`,
        );
        if (cachedResponse) {
          const parsed = JSON.parse(cachedResponse);
          return res.status(parsed.statusCode || 200).json(parsed);
        }
      } catch (err) {
        console.warn("[Booking] Redis idempotency lookup error:", err);
      }
    }

    const parsedData = bookingPayloadSchema.safeParse(req.body);
    if (!parsedData.success) {
      throw new ApiError(
        400,
        parsedData.error.message,
        parsedData.error.issues,
        "VALIDATION_FAILED",
      );
    }
    const { showtimeId, seatIds } = parsedData.data;

    const result = await BookingService.createPendingBooking(
      authUser.userId,
      showtimeId,
      seatIds,
    );

    const responsePayload = new ApiResponse(
      200,
      result,
      "Booking done! waiting for payment confirmation",
    );

    if (idempotencyKey) {
      try {
        await redis.set(
          `idempotency:booking:${idempotencyKey}`,
          JSON.stringify(responsePayload),
          "EX",
          600,
        );
      } catch (err) {
        console.warn("[Booking] Redis idempotency save error:", err);
      }
    }

    res.status(200).json(responsePayload);
  },
);

// get my bookings (authenticated user specific bookings)
export const getMyBookings = asyncHandler(
  async (req: Request, res: Response) => {
    const authUser = req.user;
    if (!authUser?.userId) {
      throw new ApiError(401, "User not authenticated");
    }

    const bookings = await BookingService.getUserBookings(authUser.userId);
    res
      .status(200)
      .json(new ApiResponse(200, bookings, "Bookings fetched successfully"));
  },
);

// get booking by ID (authorized: owner or ADMIN / SUPER_ADMIN)
export const getBooking = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const authUser = req.user;
  if (!authUser) {
    throw new ApiError(401, "User not authenticated");
  }

  const booking = await BookingService.getBookingByIdForUser(
    id as string,
    authUser,
  );
  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }
  res
    .status(200)
    .json(new ApiResponse(200, booking, "Booking fetched successfully"));
});

// get all bookings (admin only)
export const getAllBookings = asyncHandler(
  async (req: Request, res: Response) => {
    const authUser = req.user;
    if (
      !authUser ||
      (authUser.role !== "ADMIN" && authUser.role !== "SUPER_ADMIN")
    ) {
      throw new ApiError(403, "Forbidden: Admin access required");
    }

    const bookings = await BookingService.getAllBookings();
    if (!bookings) {
      throw new ApiError(404, "No bookings found");
    }
    res
      .status(200)
      .json(
        new ApiResponse(200, bookings, "All bookings fetched successfully"),
      );
  },
);
