import { Router } from "express";
import authRouter from "../modules/auth/auth.route";

const AllRouter=Router();

AllRouter.use("/auth",authRouter);

export default AllRouter;