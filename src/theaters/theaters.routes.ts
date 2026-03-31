import { Router } from "express";
import { addTheatr, deleteTheater, getTheaterById, getTheaters, updateTheater } from "./theaters.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const theaterRouter = Router();

theaterRouter.post("/add-theater",authMiddleware, addTheatr);
theaterRouter.get("/", getTheaters);
theaterRouter.get("/:id", getTheaterById);
theaterRouter.patch("/theaters/:id",authMiddleware, updateTheater);
theaterRouter.delete("/theaters/:id",authMiddleware,deleteTheater);

export default theaterRouter;
