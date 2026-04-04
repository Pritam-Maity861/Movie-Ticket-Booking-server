import { Router } from "express";
import {
  createShowtime,
  deleteShowtime,
  getShowtimeById,
  getShowtimes,
} from "./showtime.controller";

const showtimeRouter = Router();

showtimeRouter.post("/create-showtime", createShowtime);

//fetch showtimes filtered by movieId and date
showtimeRouter.post("/get-showtimes", getShowtimes);
showtimeRouter.get("/get-showtime/:id", getShowtimeById);
showtimeRouter.delete("/delete-showtime", deleteShowtime);

export default showtimeRouter;
