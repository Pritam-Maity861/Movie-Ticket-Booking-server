import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requireRoles } from "../../middleware/role.middleware";
import {
  getAllPayments,
  getPaymentsById,
  PaymentController,
  PaymentVerifyController,
} from "./payment.controller";
import { handleRazorpayWebhook } from "./payment.webhook";
import { bookingRateLimiter } from "../../middleware/rate-limit.middleware";

const paymentRouter = Router();

// Razorpay server-to-server webhook (public, signature-verified)
paymentRouter.post("/webhook", handleRazorpayWebhook);

// Create order for existing booking
paymentRouter.post(
  "/create-order",
  authMiddleware,
  bookingRateLimiter,
  PaymentController,
);

// Payment verify
paymentRouter.post("/verify", PaymentVerifyController);

// Get all payments (Admin / Super Admin only)
paymentRouter.get(
  "/get-all-payments",
  authMiddleware,
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  getAllPayments,
);

// Get payment by ID (Authorized owner or Admin / Super Admin)
paymentRouter.get("/get-payments/:id", authMiddleware, getPaymentsById);

export default paymentRouter;
