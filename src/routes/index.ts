import { Router } from "express";
import authRouter from "../modules/auth/auth.route";
import movieRouter from "../modules/movie/movie.route";

const AllRouter=Router();

AllRouter.use("/auth",authRouter);
AllRouter.use("/movie",movieRouter);

export default AllRouter;