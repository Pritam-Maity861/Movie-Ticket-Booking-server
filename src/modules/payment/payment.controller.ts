import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { PaymentService } from "./payment.service";
import { ApiResponse } from "../../utils/api-response";
import { ApiError } from "../../utils/api-error";

export const PaymentController = asyncHandler(
  async (req: Request, res: Response) => {
    const { bookingId } = req.body;
    const authUser = req.user;
    if (!authUser?.userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    const result = await PaymentService.createRazorpayOrder(
      bookingId,
      authUser.userId,
    );

    res
      .status(200)
      .json(new ApiResponse(200, result, "Order created successfully"));
  },
);

export const PaymentVerifyController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await PaymentService.verifyRazorpayPayment(req.body);
    res
      .status(200)
      .json(new ApiResponse(200, result, "Payment verified successfully"));
  },
);

export const getAllPayments = asyncHandler(
  async (req: Request, res: Response) => {
    const authUser = req.user;
    if (
      !authUser ||
      (authUser.role !== "ADMIN" && authUser.role !== "SUPER_ADMIN")
    ) {
      throw new ApiError(403, "Forbidden: Admin access required");
    }
    const result = await PaymentService.getAllPayments();
    res
      .status(200)
      .json(new ApiResponse(200, result, "Payments fetched successfully"));
  },
);

export const getPaymentsById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const authUser = req.user;
    if (!authUser) {
      throw new ApiError(401, "User not authenticated");
    }
    const result = await PaymentService.getPaymentByIdForUser(
      id as string,
      authUser,
    );
    res
      .status(200)
      .json(new ApiResponse(200, result, "Payment fetched successfully"));
  },
);
