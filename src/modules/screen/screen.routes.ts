import { Router } from "express";
import { addScreen, getScreenByTheater } from "./screen.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requireRoles } from "../../middleware/role.middleware";

const screenRouter = Router();

// Public discovery endpoint
screenRouter.get("/screens", getScreenByTheater);

// Protected mutation endpoint (Admin / Super Admin only)
screenRouter.post(
  "/create-screen",
  authMiddleware,
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  addScreen,
);

export default screenRouter;
