import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { ApiError } from "../../utils/api-error";
import { bookingPayloadSchema } from "./booking.validation";
import { BookingService } from "./booking.service";
import { ApiResponse } from "../../utils/api-response";


// create pending booking (before payment confirmation)
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


// get my bookings(user specific bookings)
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



//get booking by ID
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


//get all bookings (admin only)
export const getAllBookings=asyncHandler(async(req:Request,res:Response)=>{
  const bookings=await BookingService.getAllBookings();
  if(!bookings){
    throw new ApiError(404,"No bookings found");
  }
  res.status(200).json(new ApiResponse(200,bookings,"All bookings fetched successfully"));
})