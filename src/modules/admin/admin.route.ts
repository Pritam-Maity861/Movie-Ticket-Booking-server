import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import {
  deleteUser,
  getAllUsers,
  getDashboardStats,
  updateUserRole,
} from "./admin.controller";

const adminRouter = Router();

adminRouter.get("/stats", authMiddleware, getDashboardStats);
adminRouter.get("/users", authMiddleware, getAllUsers);
adminRouter.patch("/users/role", authMiddleware, updateUserRole);
adminRouter.delete("/users/:id", authMiddleware, deleteUser);

export default adminRouter;
