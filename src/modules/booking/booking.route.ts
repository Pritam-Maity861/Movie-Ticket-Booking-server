import { Router } from "express";
import {
  pendingBooking,
  getMyBookings,
  getBooking,
  getAllBookings,
} from "./booking.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requireRoles } from "../../middleware/role.middleware";
import { bookingRateLimiter } from "../../middleware/rate-limit.middleware";

const bookingRouter = Router();

bookingRouter.post(
  "/pending-booking",
  authMiddleware,
  bookingRateLimiter,
  pendingBooking,
);
bookingRouter.get("/my-bookings", authMiddleware, getMyBookings);
bookingRouter.get(
  "/get-all-bookings",
  authMiddleware,
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  getAllBookings,
);
bookingRouter.get("/:id", authMiddleware, getBooking);

export default bookingRouter;
