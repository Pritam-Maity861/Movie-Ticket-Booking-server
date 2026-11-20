import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requireRoles } from "../../middleware/role.middleware";
import {
  approveApprovalRequest,
  getAdminApprovalById,
  listAdminApprovals,
  rejectApprovalRequest,
} from "./approval.controller";

const adminApprovalRouter = Router();

// Guard all Admin Approval endpoints: must be ADMIN or SUPER_ADMIN
adminApprovalRouter.use(
  authMiddleware,
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
);

adminApprovalRouter.get("/", listAdminApprovals);
adminApprovalRouter.get("/:id", getAdminApprovalById);
adminApprovalRouter.patch("/:id/approve", approveApprovalRequest);
adminApprovalRouter.patch("/:id/reject", rejectApprovalRequest);

export default adminApprovalRouter;

