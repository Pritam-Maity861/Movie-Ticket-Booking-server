import { Router } from "express";
import authRouter from "../modules/auth/auth.route";
import movieRouter from "../modules/movie/movie.route";
import theaterRouter from "../theaters/theaters.routes";
import screenRouter from "../modules/screen/screen.routes";
import showtimeRouter from "../modules/showtime/showtime.routes";
import bookingRouter from "../modules/booking/booking.route";

const AllRouter = Router();

AllRouter.use("/auth", authRouter);
AllRouter.use("/movie", movieRouter);
AllRouter.use("/theaters", theaterRouter);
AllRouter.use("/screen", screenRouter);
AllRouter.use("/showtime", showtimeRouter);
AllRouter.use("/booking", bookingRouter);

export default AllRouter;
