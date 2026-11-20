import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { ApiResponse } from "../../utils/api-response";
import { ApiError } from "../../utils/api-error";
import { ApprovalService } from "./approval.service";
import { ApprovalStatus, ApprovalTargetType } from "../../generated/prisma/client";

// ==========================================
// THEATER OWNER CONTROLLER (MAKER)
// ==========================================

export const createTheaterRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const authUser = req.user;
    if (!authUser) {
      throw new ApiError(401, "User not authenticated", [], "UNAUTHORIZED");
    }

    const { name, city, address, amenities, rating, ratting } = req.body;
    if (!name || !city || !address) {
      throw new ApiError(
        400,
        "Name, city, and address are required",
        [],
        "VALIDATION_FAILED",
      );
    }

    const request = await ApprovalService.submitRequest({
      ownerId: authUser.userId,
      targetType: "REGISTER_THEATER",
      payload: {
        name,
        city,
        address,
        amenities: amenities || [],
        rating: rating || ratting || 0,
      },
    });

    res
      .status(201)
      .json(
        new ApiResponse(
          201,
          request,
          "Theater registration request submitted for admin approval",
        ),
      );
  },
);

export const updateTheaterRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const authUser = req.user;
    if (!authUser) {
      throw new ApiError(401, "User not authenticated", [], "UNAUTHORIZED");
    }
    const { id } = req.params;

    const request = await ApprovalService.submitRequest({
      ownerId: authUser.userId,
      theaterId: id as string,
      targetType: "UPDATE_THEATER",
      payload: req.body,
    });

    res
      .status(201)
      .json(
        new ApiResponse(
          201,
          request,
          "Theater update request submitted for admin approval",
        ),
      );
  },
);

export const createScreenRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const authUser = req.user;
    if (!authUser) {
      throw new ApiError(401, "User not authenticated", [], "UNAUTHORIZED");
    }
    const { id } = req.params; // theaterId
    const { name, totalSeats, seats, rows, seatsPerRow } = req.body;

    const computedTotal =
      Number(totalSeats) ||
      (rows && Array.isArray(rows) && seatsPerRow
        ? rows.length * Number(seatsPerRow)
        : 100);

    if (!name) {
      throw new ApiError(
        400,
        "Screen name is required",
        [],
        "VALIDATION_FAILED",
      );
    }

    const request = await ApprovalService.submitRequest({
      ownerId: authUser.userId,
      theaterId: id as string,
      targetType: "CREATE_SCREEN",
      payload: {
        name,
        totalSeats: computedTotal,
        seats,
        rows,
        seatsPerRow: seatsPerRow ? Number(seatsPerRow) : undefined,
      },
    });

    res
      .status(201)
      .json(
        new ApiResponse(
          201,
          request,
          "Screen creation request submitted for admin approval",
        ),
      );
  },
);

export const updateScreenRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const authUser = req.user;
    if (!authUser) {
      throw new ApiError(401, "User not authenticated", [], "UNAUTHORIZED");
    }
    const { screenId } = req.params;

    const request = await ApprovalService.submitRequest({
      ownerId: authUser.userId,
      targetId: screenId as string,
      targetType: "UPDATE_SCREEN",
      payload: req.body,
    });

    res
      .status(201)
      .json(
        new ApiResponse(
          201,
          request,
          "Screen update request submitted for admin approval",
        ),
      );
  },
);

export const deleteScreenRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const authUser = req.user;
    if (!authUser) {
      throw new ApiError(401, "User not authenticated", [], "UNAUTHORIZED");
    }
    const { screenId } = req.params;

    const request = await ApprovalService.submitRequest({
      ownerId: authUser.userId,
      targetId: screenId as string,
      targetType: "DELETE_SCREEN",
      payload: { screenId },
    });

    res
      .status(201)
      .json(
        new ApiResponse(
          201,
          request,
          "Screen deletion request submitted for admin approval",
        ),
      );
  },
);

export const createShowtimeRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const authUser = req.user;
    if (!authUser) {
      throw new ApiError(401, "User not authenticated", [], "UNAUTHORIZED");
    }
    const {
      movieId,
      screenId,
      startTime,
      endTime,
      regularSeatPrice,
      premiumSeatPrice,
      vipSeatPrice,
    } = req.body;

    if (!movieId || !screenId || !startTime || !endTime) {
      throw new ApiError(
        400,
        "movieId, screenId, startTime, and endTime are required",
        [],
        "VALIDATION_FAILED",
      );
    }

    const request = await ApprovalService.submitRequest({
      ownerId: authUser.userId,
      targetType: "CREATE_SHOWTIME",
      payload: {
        movieId,
        screenId,
        startTime,
        endTime,
        regularSeatPrice: regularSeatPrice || 150,
        premiumSeatPrice: premiumSeatPrice || 250,
        vipSeatPrice: vipSeatPrice || 400,
      },
    });

    res
      .status(201)
      .json(
        new ApiResponse(
          201,
          request,
          "Showtime creation request submitted for admin approval",
        ),
      );
  },
);

export const deleteShowtimeRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const authUser = req.user;
    if (!authUser) {
      throw new ApiError(401, "User not authenticated", [], "UNAUTHORIZED");
    }
    const { showtimeId } = req.params;

    const request = await ApprovalService.submitRequest({
      ownerId: authUser.userId,
      targetId: showtimeId as string,
      targetType: "DELETE_SHOWTIME",
      payload: { showtimeId },
    });

    res
      .status(201)
      .json(
        new ApiResponse(
          201,
          request,
          "Showtime deletion request submitted for admin approval",
        ),
      );
  },
);

export const getMyRequests = asyncHandler(
  async (req: Request, res: Response) => {
    const authUser = req.user;
    if (!authUser) {
      throw new ApiError(401, "User not authenticated", [], "UNAUTHORIZED");
    }

    const requests = await ApprovalService.getMyRequests(authUser.userId);
    res
      .status(200)
      .json(
        new ApiResponse(200, requests, "Submitted requests fetched successfully"),
      );
  },
);

export const getMyTheaters = asyncHandler(
  async (req: Request, res: Response) => {
    const authUser = req.user;
    if (!authUser) {
      throw new ApiError(401, "User not authenticated", [], "UNAUTHORIZED");
    }

    const theaters = await ApprovalService.getMyTheaters(authUser.userId);
    res
      .status(200)
      .json(
        new ApiResponse(200, theaters, "Owned theaters fetched successfully"),
      );
  },
);

export const getRequestDetails = asyncHandler(
  async (req: Request, res: Response) => {
    const authUser = req.user;
    if (!authUser) {
      throw new ApiError(401, "User not authenticated", [], "UNAUTHORIZED");
    }
    const { id } = req.params;

    const request = await ApprovalService.getRequestById(id as string, authUser);
    res
      .status(200)
      .json(
        new ApiResponse(200, request, "Approval request details fetched"),
      );
  },
);

// ==========================================
// ADMIN APPROVAL CONTROLLER (CHECKER)
// ==========================================

export const listAdminApprovals = asyncHandler(
  async (req: Request, res: Response) => {
    const status = req.query.status as ApprovalStatus | undefined;
    const targetType = req.query.targetType as ApprovalTargetType | undefined;

    const requests = await ApprovalService.listAdminRequests(status, targetType);
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          requests,
          "Admin approval queue fetched successfully",
        ),
      );
  },
);

export const getAdminApprovalById = asyncHandler(
  async (req: Request, res: Response) => {
    const authUser = req.user;
    if (!authUser) {
      throw new ApiError(401, "User not authenticated", [], "UNAUTHORIZED");
    }
    const { id } = req.params;

    const request = await ApprovalService.getRequestById(id as string, authUser);
    res
      .status(200)
      .json(new ApiResponse(200, request, "Approval request retrieved"));
  },
);

export const approveApprovalRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const authUser = req.user;
    if (!authUser) {
      throw new ApiError(401, "User not authenticated", [], "UNAUTHORIZED");
    }
    const { id } = req.params;
    const { feedback } = req.body;

    const result = await ApprovalService.approveRequest(
      id as string,
      authUser.userId,
      feedback,
    );

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          result,
          "Request approved and changes successfully published to live catalog",
        ),
      );
  },
);

export const rejectApprovalRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const authUser = req.user;
    if (!authUser) {
      throw new ApiError(401, "User not authenticated", [], "UNAUTHORIZED");
    }
    const { id } = req.params;
    const { feedback } = req.body;

    if (!feedback) {
      throw new ApiError(
        400,
        "Feedback explaining the rejection reason is required",
        [],
        "FEEDBACK_REQUIRED",
      );
    }

    const result = await ApprovalService.rejectRequest(
      id as string,
      authUser.userId,
      feedback,
    );

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          result,
          "Request rejected with constructive feedback",
        ),
      );
  },
);
