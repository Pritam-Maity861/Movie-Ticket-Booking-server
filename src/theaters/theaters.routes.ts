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

// Public discovery endpoints
theaterRouter.get("/", getTheaters);
theaterRouter.get("/:id", getTheaterById);

// Protected mutation endpoints (Admin / Super Admin only)
theaterRouter.post(
  "/add-theater",
  authMiddleware,
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  addTheatr,
);
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
