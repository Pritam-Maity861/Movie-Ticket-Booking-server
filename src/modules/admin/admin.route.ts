import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requireRoles } from "../../middleware/role.middleware";
import {
  deleteUser,
  getAllUsers,
  getDashboardStats,
  updateUserRole,
} from "./admin.controller";

const adminRouter = Router();

adminRouter.get(
  "/stats",
  authMiddleware,
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  getDashboardStats,
);
adminRouter.get(
  "/users",
  authMiddleware,
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  getAllUsers,
);
adminRouter.patch(
  "/users/role",
  authMiddleware,
  requireRoles(["SUPER_ADMIN"]),
  updateUserRole,
);
adminRouter.delete(
  "/users/:id",
  authMiddleware,
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  deleteUser,
);

export default adminRouter;
