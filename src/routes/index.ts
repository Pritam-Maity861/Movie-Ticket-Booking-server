import { Router } from "express";
import authRouter from "../modules/auth/auth.route";
import movieRouter from "../modules/movie/movie.route";
import theaterRouter from "../theaters/theaters.routes";
import screenRouter from "../modules/screen/screen.routes";
import showtimeRouter from "../modules/showtime/showtime.routes";

const AllRouter=Router();

AllRouter.use("/auth",authRouter);
AllRouter.use("/movie",movieRouter);
AllRouter.use("/theaters",theaterRouter);
AllRouter.use("/screen",screenRouter);
AllRouter.use("/showtime",showtimeRouter);

export default AllRouter;