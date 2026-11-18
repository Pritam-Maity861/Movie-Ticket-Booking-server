import { Router } from "express";
import {
  createShowtime,
  deleteShowtime,
  getShowtimeById,
  getShowtimes,
  getShowtimesByScreenId,
} from "./showtime.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requireRoles } from "../../middleware/role.middleware";

const showtimeRouter = Router();

showtimeRouter.post(
  "/create-showtime",
  authMiddleware,
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  createShowtime,
);

// fetch showtimes filtered by movieId and date
showtimeRouter.post("/get-showtimes", authMiddleware, getShowtimes);
showtimeRouter.get(
  "/get-showtimes/screen/:screenId",
  authMiddleware,
  getShowtimesByScreenId,
);
showtimeRouter.get("/get-showtime/:id", authMiddleware, getShowtimeById);
showtimeRouter.delete(
  "/delete-showtime",
  authMiddleware,
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  deleteShowtime,
);

export default showtimeRouter;
