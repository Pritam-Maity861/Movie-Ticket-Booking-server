import { Router } from "express";
import {
  createShowtime,
  deleteShowtime,
  getShowtimeById,
  getShowtimes,
  getShowtimesByScreenId,
} from "./showtime.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const showtimeRouter = Router();

showtimeRouter.post("/create-showtime", authMiddleware, createShowtime);

//fetch showtimes filtered by movieId and date
showtimeRouter.post("/get-showtimes", authMiddleware, getShowtimes);
showtimeRouter.get(
  "/get-showtimes/screen/:screenId",
  authMiddleware,
  getShowtimesByScreenId,
);
showtimeRouter.get("/get-showtime/:id", authMiddleware, getShowtimeById);
showtimeRouter.delete("/delete-showtime", authMiddleware, deleteShowtime);

export default showtimeRouter;
