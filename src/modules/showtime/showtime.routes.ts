import { Router } from "express";
import {
  createShowtime,
  deleteShowtime,
  getShowtimeById,
  getShowtimeSeats,
  getShowtimes,
  getShowtimesByScreenId,
} from "./showtime.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requireRoles } from "../../middleware/role.middleware";

const showtimeRouter = Router();

// Public discovery endpoints for clients & AI agents
// 1. RESTful query: GET /api/v1/showtime?movieId=...&date=...&theaterId=...
showtimeRouter.get("/", getShowtimes);
// 2. Legacy POST: POST /api/v1/showtime/get-showtimes (backward compatibility)
showtimeRouter.post("/get-showtimes", getShowtimes);
// 3. Real-time Seat Availability Map: GET /api/v1/showtime/:id/seats & /get-showtime/:id/seats
showtimeRouter.get("/:id/seats", getShowtimeSeats);
showtimeRouter.get("/get-showtime/:id/seats", getShowtimeSeats);
// 4. RESTful ID lookup: GET /api/v1/showtime/:id
showtimeRouter.get("/:id", getShowtimeById);
// 5. Legacy ID lookup: GET /api/v1/showtime/get-showtime/:id
showtimeRouter.get("/get-showtime/:id", getShowtimeById);
// 6. Showtimes by screen: GET /api/v1/showtime/get-showtimes/screen/:screenId
showtimeRouter.get(
  "/get-showtimes/screen/:screenId",
  getShowtimesByScreenId,
);

// Protected mutation endpoints (Admin / Super Admin only)
showtimeRouter.post(
  "/create-showtime",
  authMiddleware,
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  createShowtime,
);
showtimeRouter.delete(
  "/delete-showtime",
  authMiddleware,
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  deleteShowtime,
);

export default showtimeRouter;
