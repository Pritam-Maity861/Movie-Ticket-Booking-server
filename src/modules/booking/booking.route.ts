import { Router } from "express";
import {
  pendingBooking,
  getMyBookings,
  getBooking,
} from "./booking.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const bookingRouter = Router();

bookingRouter.post("/pending-booking", authMiddleware, pendingBooking);
bookingRouter.get("/my-bookings", authMiddleware, getMyBookings);
bookingRouter.get("/:id", authMiddleware, getBooking);

export default bookingRouter;
