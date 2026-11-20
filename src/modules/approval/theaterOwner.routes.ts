import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requireRoles } from "../../middleware/role.middleware";
import {
  createScreenRequest,
  createShowtimeRequest,
  createTheaterRequest,
  deleteScreenRequest,
  deleteShowtimeRequest,
  getMyRequests,
  getMyTheaters,
  getRequestDetails,
  updateScreenRequest,
  updateTheaterRequest,
} from "./approval.controller";

const theaterOwnerRouter = Router();

// Guard all Theater Owner endpoints: must be logged in with role THEATER_OWNER, ADMIN, or SUPER_ADMIN
theaterOwnerRouter.use(
  authMiddleware,
  requireRoles(["THEATER_OWNER", "ADMIN", "SUPER_ADMIN"]),
);

// Theater endpoints
theaterOwnerRouter.post("/theaters", createTheaterRequest);
theaterOwnerRouter.patch("/theaters/:id", updateTheaterRequest);
theaterOwnerRouter.get("/my-theaters", getMyTheaters);

// Screen endpoints
theaterOwnerRouter.post("/theaters/:id/screens", createScreenRequest);
theaterOwnerRouter.patch("/screens/:screenId", updateScreenRequest);
theaterOwnerRouter.delete("/screens/:screenId", deleteScreenRequest);

// Showtime endpoints
theaterOwnerRouter.post("/showtimes", createShowtimeRequest);
theaterOwnerRouter.delete("/showtimes/:showtimeId", deleteShowtimeRequest);

// Requests audit & feedback
theaterOwnerRouter.get("/my-requests", getMyRequests);
theaterOwnerRouter.get("/my-requests/:id", getRequestDetails);

export default theaterOwnerRouter;

