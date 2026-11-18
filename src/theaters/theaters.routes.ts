import { Router } from "express";
import {
  addTheatr,
  deleteTheater,
  getTheaterById,
  getTheaters,
  updateTheater,
} from "./theaters.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { requireRoles } from "../middleware/role.middleware";

const theaterRouter = Router();

theaterRouter.post(
  "/add-theater",
  authMiddleware,
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  addTheatr,
);
theaterRouter.get("/", authMiddleware, getTheaters);
theaterRouter.get("/:id", authMiddleware, getTheaterById);
theaterRouter.patch(
  "/:id",
  authMiddleware,
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  updateTheater,
);
theaterRouter.delete(
  "/:id",
  authMiddleware,
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  deleteTheater,
);

export default theaterRouter;
