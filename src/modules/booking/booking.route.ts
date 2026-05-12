import { Router } from "express";
import {
  pendingBooking,
  getMyBookings,
  getBooking,
  getAllBookings,
} from "./booking.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const bookingRouter = Router();

bookingRouter.post("/pending-booking", authMiddleware, pendingBooking);
bookingRouter.get("/my-bookings", authMiddleware, getMyBookings);
bookingRouter.get("/get-all-bookings",authMiddleware, getAllBookings);
bookingRouter.get("/:id", authMiddleware, getBooking);

export default bookingRouter;
