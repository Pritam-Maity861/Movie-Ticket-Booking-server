import { Router } from "express";
import { addScreen, getScreenByTheater } from "./screen.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requireRoles } from "../../middleware/role.middleware";

const screenRouter = Router();

screenRouter.post(
  "/create-screen",
  authMiddleware,
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  addScreen,
);
screenRouter.get("/screens", authMiddleware, getScreenByTheater);

export default screenRouter;
