import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/api-error";
import { ApprovalStatus, ApprovalTargetType, SeatType } from "../../generated/prisma/client";
import { AuthUser } from "../../types/express";
import { generateSeatGrid, getSeatTypeByRow } from "../screen/screen.utils";

export class ApprovalService {
  /**
   * Submit a change or registration request by a THEATER_OWNER (Maker).
   */
  static async submitRequest(params: {
    ownerId: string;
    targetType: ApprovalTargetType;
    payload: any;
    theaterId?: string;
    targetId?: string;
  }) {
    const { ownerId, targetType, payload, theaterId, targetId } = params;

    // Verify theater ownership if theaterId is specified
    if (theaterId) {
      const theater = await prisma.theater.findUnique({
        where: { id: theaterId },
      });
      if (!theater) {
        throw new ApiError(404, "Theater not found", [], "THEATER_NOT_FOUND");
      }
      if (theater.ownerId && theater.ownerId !== ownerId) {
        throw new ApiError(
          403,
          "You are not the owner of this theater",
          [],
          "FORBIDDEN",
        );
      }
    }

    // If registering a new theater, pre-create the Theater in PENDING status
    let createdTheaterId = theaterId;
    if (targetType === "REGISTER_THEATER") {
      const newTheater = await prisma.theater.create({
        data: {
          name: payload.name,
          city: payload.city,
          address: payload.address,
          amenities: payload.amenities || [],
          ratting: payload.ratting || payload.rating || 0,
          rating: payload.rating || payload.ratting || 0,
          status: "PENDING",
          ownerId,
        },
      });
      createdTheaterId = newTheater.id;
    }

    const request = await prisma.approvalRequest.create({
      data: {
        ownerId,
        theaterId: createdTheaterId,
        targetType,
        targetId,
        payload,
        status: "PENDING",
      },
      include: {
        theater: true,
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return request;
  }

  /**
   * List all requests submitted by a specific THEATER_OWNER.
   */
  static async getMyRequests(ownerId: string) {
    return await prisma.approvalRequest.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
      include: {
        theater: true,
        reviewedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  /**
   * Get single request details (accessible by owner or Admin/Super Admin).
   */
  static async getRequestById(requestId: string, user: AuthUser) {
    const request = await prisma.approvalRequest.findUnique({
      where: { id: requestId },
      include: {
        theater: true,
        owner: {
          select: { id: true, name: true, email: true },
        },
        reviewedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!request) {
      throw new ApiError(404, "Approval request not found", [], "NOT_FOUND");
    }

    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    if (!isAdmin && request.ownerId !== user.userId) {
      throw new ApiError(404, "Approval request not found", [], "NOT_FOUND");
    }

    return request;
  }

  /**
   * Get theaters owned by a specific THEATER_OWNER.
   */
  static async getMyTheaters(ownerId: string) {
    return await prisma.theater.findMany({
      where: { ownerId },
      include: {
        screens: {
          include: {
            seats: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Checker: List all requests for Admin review.
   */
  static async listAdminRequests(status?: ApprovalStatus, targetType?: ApprovalTargetType) {
    return await prisma.approvalRequest.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(targetType ? { targetType } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        theater: true,
        owner: {
          select: { id: true, name: true, email: true },
        },
        reviewedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  /**
   * Checker: Approve a pending request and transactionally apply changes to live catalog.
   */
  static async approveRequest(
    requestId: string,
    adminId: string,
    adminFeedback: string = "Approved by Administrator",
  ) {
    const request = await prisma.approvalRequest.findUnique({
      where: { id: requestId },
      include: { theater: true },
    });

    if (!request) {
      throw new ApiError(404, "Approval request not found", [], "REQUEST_NOT_FOUND");
    }

    if (request.status !== "PENDING") {
      throw new ApiError(
        400,
        `Cannot approve request with status '${request.status}'`,
        [],
        "INVALID_STATE",
      );
    }

    const payload = request.payload as any;

    return await prisma.$transaction(async (tx) => {
      switch (request.targetType) {
        case "REGISTER_THEATER": {
          if (request.theaterId) {
            await tx.theater.update({
              where: { id: request.theaterId },
              data: { status: "APPROVED" },
            });
          }
          break;
        }

        case "UPDATE_THEATER": {
          if (request.theaterId) {
            await tx.theater.update({
              where: { id: request.theaterId },
              data: {
                ...(payload.name ? { name: payload.name } : {}),
                ...(payload.city ? { city: payload.city } : {}),
                ...(payload.address ? { address: payload.address } : {}),
                ...(payload.amenities ? { amenities: payload.amenities } : {}),
                ...(payload.rating ? { rating: payload.rating, ratting: payload.rating } : {}),
              },
            });
          }
          break;
        }

        case "CREATE_SCREEN": {
          const theaterId = request.theaterId || payload.theaterId;
          if (!theaterId) {
            throw new ApiError(400, "theaterId is required to create screen");
          }

          const totalSeats =
            Number(payload.totalSeats) ||
            (payload.rows && payload.seatsPerRow
              ? payload.rows.length * Number(payload.seatsPerRow)
              : 100);

          const screen = await tx.screen.create({
            data: {
              theaterId,
              name: payload.name,
              totalSeats,
            },
          });

          // Always ensure seats are populated for the screen
          let seatsToCreate: any[] = [];
          if (payload.seats && Array.isArray(payload.seats) && payload.seats.length > 0) {
            seatsToCreate = payload.seats.map((s: any) => ({
              screenId: screen.id,
              row: String(s.row).toUpperCase(),
              number: Number(s.number),
              type: (s.type as SeatType) || getSeatTypeByRow(s.row),
            }));
          } else {
            seatsToCreate = generateSeatGrid(
              screen.id,
              totalSeats,
              payload.rows,
              payload.seatsPerRow ? Number(payload.seatsPerRow) : undefined,
            );
          }

          if (seatsToCreate.length > 0) {
            await tx.seat.createMany({
              data: seatsToCreate,
              skipDuplicates: true,
            });
          }
          break;
        }

        case "UPDATE_SCREEN": {
          if (!request.targetId) {
            throw new ApiError(400, "targetId (screenId) required for screen update");
          }
          await tx.screen.update({
            where: { id: request.targetId },
            data: {
              ...(payload.name ? { name: payload.name } : {}),
              ...(payload.totalSeats ? { totalSeats: payload.totalSeats } : {}),
            },
          });
          break;
        }

        case "DELETE_SCREEN": {
          if (!request.targetId) {
            throw new ApiError(400, "targetId (screenId) required for screen deletion");
          }
          await tx.screen.delete({
            where: { id: request.targetId },
          });
          break;
        }

        case "CREATE_SHOWTIME": {
          const startTime = new Date(payload.startTime);
          const endTime = new Date(payload.endTime);

          const showtime = await tx.showtime.create({
            data: {
              movieId: payload.movieId,
              screenId: payload.screenId,
              startTime,
              endTime,
            },
          });

          // Add seat pricing
          const pricingRows = [
            { showtimeId: showtime.id, seatType: "REGULAR" as SeatType, price: payload.regularSeatPrice || 150 },
            { showtimeId: showtime.id, seatType: "PREMIUM" as SeatType, price: payload.premiumSeatPrice || 250 },
            { showtimeId: showtime.id, seatType: "VIP" as SeatType, price: payload.vipSeatPrice || 400 },
          ];

          await tx.seatPricing.createMany({
            data: pricingRows,
          });

          // Safety net: ensure the screen has seats populated so showtime never goes live with 0 seats
          const existingSeatsCount = await tx.seat.count({
            where: { screenId: payload.screenId },
          });
          if (existingSeatsCount === 0) {
            const screen = await tx.screen.findUnique({
              where: { id: payload.screenId },
            });
            if (screen) {
              const defaultSeats = generateSeatGrid(
                screen.id,
                screen.totalSeats || 100,
              );
              if (defaultSeats.length > 0) {
                await tx.seat.createMany({
                  data: defaultSeats,
                  skipDuplicates: true,
                });
              }
            }
          }
          break;
        }

        case "DELETE_SHOWTIME": {
          if (!request.targetId) {
            throw new ApiError(400, "targetId (showtimeId) required for showtime deletion");
          }
          await tx.showtime.delete({
            where: { id: request.targetId },
          });
          break;
        }

        default:
          throw new ApiError(400, `Unknown targetType ${request.targetType}`);
      }

      // Mark request as APPROVED
      return await tx.approvalRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED",
          adminFeedback,
          reviewedById: adminId,
          reviewedAt: new Date(),
        },
        include: {
          theater: true,
          reviewedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    });
  }

  /**
   * Checker: Reject a pending request with required constructive feedback.
   */
  static async rejectRequest(
    requestId: string,
    adminId: string,
    feedback: string,
  ) {
    if (!feedback || feedback.trim().length === 0) {
      throw new ApiError(
        400,
        "Feedback explaining the rejection reason is required",
        [],
        "FEEDBACK_REQUIRED",
      );
    }

    const request = await prisma.approvalRequest.findUnique({
      where: { id: requestId },
      include: { theater: true },
    });

    if (!request) {
      throw new ApiError(404, "Approval request not found", [], "REQUEST_NOT_FOUND");
    }

    if (request.status !== "PENDING") {
      throw new ApiError(
        400,
        `Cannot reject request with status '${request.status}'`,
        [],
        "INVALID_STATE",
      );
    }

    return await prisma.$transaction(async (tx) => {
      // If rejecting an initial theater registration, set theater status to REJECTED
      if (request.targetType === "REGISTER_THEATER" && request.theaterId) {
        await tx.theater.update({
          where: { id: request.theaterId },
          data: { status: "REJECTED" },
        });
      }

      return await tx.approvalRequest.update({
        where: { id: requestId },
        data: {
          status: "REJECTED",
          adminFeedback: feedback,
          reviewedById: adminId,
          reviewedAt: new Date(),
        },
        include: {
          theater: true,
          reviewedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    });
  }
}
