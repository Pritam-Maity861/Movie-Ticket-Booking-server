import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ApprovalService } from "../modules/approval/approval.service";
import { TheaterRepository } from "../theaters/theaters.repository";
import { prisma } from "../config/prisma";
import { redis } from "../config/redis";
import { AuthUser } from "../types/express";
import { ApiError } from "../utils/api-error";

// Disconnect redis in test environment to avoid unhandled DNS lookups
try {
  redis.disconnect();
} catch {}

describe("Section B & C: Idempotency, Error Codes & Maker-Checker Admin Approval Engine", () => {
  const theaterOwnerUser: AuthUser = {
    userId: "owner-user-001",
    role: "THEATER_OWNER",
    email: "owner@cinema.com",
  };

  const adminUser: AuthUser = {
    userId: "admin-user-001",
    role: "ADMIN",
    email: "admin@cinemate.com",
  };

  const normalUser: AuthUser = {
    userId: "normal-user-001",
    role: "USER",
    email: "user@test.com",
  };

  // --------------------------------------------------------------------------
  // SUITE 1: Standardized Error Codes (Change 6)
  // --------------------------------------------------------------------------
  describe("Suite 1: Standardized Machine-Readable Error Codes (Change 6)", () => {
    it("should default errorCode based on HTTP status code", () => {
      const err400 = new ApiError(400, "Bad input");
      assert.strictEqual(err400.errorCode, "BAD_REQUEST");

      const err401 = new ApiError(401, "No token");
      assert.strictEqual(err401.errorCode, "UNAUTHORIZED");

      const err403 = new ApiError(403, "Forbidden resource");
      assert.strictEqual(err403.errorCode, "FORBIDDEN");

      const err404 = new ApiError(404, "Not found");
      assert.strictEqual(err404.errorCode, "NOT_FOUND");

      const err409 = new ApiError(409, "Seat taken");
      assert.strictEqual(err409.errorCode, "CONFLICT");
    });

    it("should retain custom machine-readable errorCode when explicitly provided", () => {
      const errCustom = new ApiError(
        409,
        "Seat already booked",
        [],
        "SEAT_ALREADY_TAKEN",
      );
      assert.strictEqual(errCustom.errorCode, "SEAT_ALREADY_TAKEN");
      assert.strictEqual(errCustom.statusCode, 409);
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 2: Maker-Checker Approval Request Submission (Section C)
  // --------------------------------------------------------------------------
  describe("Suite 2: Theater Owner Request Submission (Maker)", () => {
    it("should create PENDING theater and ApprovalRequest upon REGISTER_THEATER", async () => {
      let createdTheaterData: any = null;
      let createdRequestData: any = null;

      const originalTheaterCreate = prisma.theater.create;
      const originalRequestCreate = prisma.approvalRequest.create;

      (prisma.theater as any).create = async ({ data }: any) => {
        createdTheaterData = data;
        return {
          id: "theater-pending-99",
          ...data,
        };
      };

      (prisma.approvalRequest as any).create = async ({ data }: any) => {
        createdRequestData = data;
        return {
          id: "req-99",
          ...data,
          theater: { id: "theater-pending-99", name: data.payload.name },
          owner: { id: theaterOwnerUser.userId, name: "Owner", email: theaterOwnerUser.email },
        };
      };

      try {
        const result = await ApprovalService.submitRequest({
          ownerId: theaterOwnerUser.userId,
          targetType: "REGISTER_THEATER",
          payload: {
            name: "Star Grand Cinema",
            city: "Mumbai",
            address: "42 Bandra West",
            amenities: ["IMAX", "Dolby Atmos"],
          },
        });

        assert.strictEqual(createdTheaterData.status, "PENDING");
        assert.strictEqual(createdTheaterData.ownerId, theaterOwnerUser.userId);
        assert.strictEqual(createdRequestData.status, "PENDING");
        assert.strictEqual(createdRequestData.theaterId, "theater-pending-99");
        assert.strictEqual(result.id, "req-99");
      } finally {
        (prisma.theater as any).create = originalTheaterCreate;
        (prisma.approvalRequest as any).create = originalRequestCreate;
      }
    });

    it("should reject request submission if theater does not belong to owner", async () => {
      const originalTheaterFindUnique = prisma.theater.findUnique;
      (prisma.theater as any).findUnique = async () => ({
        id: "theater-other-owner",
        ownerId: "different-owner-id",
      });

      try {
        await assert.rejects(
          async () => {
            await ApprovalService.submitRequest({
              ownerId: theaterOwnerUser.userId,
              theaterId: "theater-other-owner",
              targetType: "UPDATE_THEATER",
              payload: { name: "Hijacked Theater" },
            });
          },
          (err: any) => {
            assert.strictEqual(err.statusCode, 403);
            assert.strictEqual(err.errorCode, "FORBIDDEN");
            return true;
          },
        );
      } finally {
        (prisma.theater as any).findUnique = originalTheaterFindUnique;
      }
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 3: Checker (Admin) Approval & Rejection Flow
  // --------------------------------------------------------------------------
  describe("Suite 3: Admin Approval & Rejection Engine (Checker)", () => {
    it("should transactionally approve REGISTER_THEATER and update theater status to APPROVED", async () => {
      let updatedTheaterId: string | null = null;
      let updatedTheaterStatus: string | null = null;
      let updatedReqStatus: string | null = null;

      const originalRequestFindUnique = prisma.approvalRequest.findUnique;
      const originalTransaction = prisma.$transaction;

      (prisma.approvalRequest as any).findUnique = async () => ({
        id: "req-approve-1",
        ownerId: theaterOwnerUser.userId,
        theaterId: "theater-to-approve",
        targetType: "REGISTER_THEATER",
        status: "PENDING",
        payload: { name: "Star Grand Cinema" },
      });

      (prisma as any).$transaction = async (fn: any) => {
        const fakeTx = {
          theater: {
            update: async ({ where, data }: any) => {
              updatedTheaterId = where.id;
              updatedTheaterStatus = data.status;
            },
          },
          approvalRequest: {
            update: async ({ where, data }: any) => {
              updatedReqStatus = data.status;
              return {
                id: where.id,
                ...data,
              };
            },
          },
        };
        return await fn(fakeTx);
      };

      try {
        const approved = await ApprovalService.approveRequest(
          "req-approve-1",
          adminUser.userId,
          "Approved for live catalog",
        );

        assert.strictEqual(updatedTheaterId, "theater-to-approve");
        assert.strictEqual(updatedTheaterStatus, "APPROVED");
        assert.strictEqual(updatedReqStatus, "APPROVED");
        assert.strictEqual(approved.status, "APPROVED");
      } finally {
        (prisma.approvalRequest as any).findUnique = originalRequestFindUnique;
        (prisma as any).$transaction = originalTransaction;
      }
    });

    it("should reject request with mandatory feedback and set theater to REJECTED", async () => {
      let updatedTheaterStatus: string | null = null;
      let updatedFeedback: string | null = null;

      const originalRequestFindUnique = prisma.approvalRequest.findUnique;
      const originalTransaction = prisma.$transaction;

      (prisma.approvalRequest as any).findUnique = async () => ({
        id: "req-reject-1",
        ownerId: theaterOwnerUser.userId,
        theaterId: "theater-to-reject",
        targetType: "REGISTER_THEATER",
        status: "PENDING",
        payload: { name: "Fake Theater" },
      });

      (prisma as any).$transaction = async (fn: any) => {
        const fakeTx = {
          theater: {
            update: async ({ data }: any) => {
              updatedTheaterStatus = data.status;
            },
          },
          approvalRequest: {
            update: async ({ data }: any) => {
              updatedFeedback = data.adminFeedback;
              return {
                id: "req-reject-1",
                ...data,
              };
            },
          },
        };
        return await fn(fakeTx);
      };

      try {
        const rejected = await ApprovalService.rejectRequest(
          "req-reject-1",
          adminUser.userId,
          "Invalid registration documents and address not found.",
        );

        assert.strictEqual(updatedTheaterStatus, "REJECTED");
        assert.strictEqual(
          updatedFeedback,
          "Invalid registration documents and address not found.",
        );
        assert.strictEqual(rejected.status, "REJECTED");
      } finally {
        (prisma.approvalRequest as any).findUnique = originalRequestFindUnique;
        (prisma as any).$transaction = originalTransaction;
      }
    });

    it("should fail rejection if feedback is empty", async () => {
      await assert.rejects(
        async () => {
          await ApprovalService.rejectRequest("req-1", adminUser.userId, "   ");
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.errorCode, "FEEDBACK_REQUIRED");
          return true;
        },
      );
    });

    it("should automatically generate seats when approving CREATE_SCREEN without explicit seats", async () => {
      let createdScreenData: any = null;
      let createdSeats: any[] = [];

      const originalRequestFindUnique = prisma.approvalRequest.findUnique;
      const originalTransaction = prisma.$transaction;

      (prisma.approvalRequest as any).findUnique = async () => ({
        id: "req-create-screen-1",
        ownerId: theaterOwnerUser.userId,
        theaterId: "theater-screen-1",
        targetType: "CREATE_SCREEN",
        status: "PENDING",
        payload: { name: "IMAX Laser", totalSeats: 100 },
      });

      (prisma as any).$transaction = async (fn: any) => {
        const fakeTx = {
          screen: {
            create: async ({ data }: any) => {
              createdScreenData = data;
              return { id: "new-screen-1", ...data };
            },
          },
          seat: {
            createMany: async ({ data }: any) => {
              createdSeats = data;
              return { count: data.length };
            },
          },
          approvalRequest: {
            update: async ({ where, data }: any) => ({
              id: where.id,
              ...data,
            }),
          },
        };
        return await fn(fakeTx);
      };

      try {
        const approved = await ApprovalService.approveRequest(
          "req-create-screen-1",
          adminUser.userId,
        );
        assert.strictEqual(approved.status, "APPROVED");
        assert.strictEqual(createdScreenData.name, "IMAX Laser");
        assert.strictEqual(createdScreenData.totalSeats, 100);
        assert.strictEqual(createdSeats.length, 100);
        assert.strictEqual(createdSeats[0].row, "A");
        assert.strictEqual(createdSeats[0].number, 1);
        assert.strictEqual(createdSeats[0].type, "PREMIUM");
      } finally {
        (prisma.approvalRequest as any).findUnique = originalRequestFindUnique;
        (prisma as any).$transaction = originalTransaction;
      }
    });

    it("should ensure screen has seats when approving CREATE_SHOWTIME if screen had 0 seats", async () => {
      let createdShowtime: any = null;
      let backfilledSeats: any[] = [];
      let createdPricingCount = 0;

      const originalRequestFindUnique = prisma.approvalRequest.findUnique;
      const originalTransaction = prisma.$transaction;

      (prisma.approvalRequest as any).findUnique = async () => ({
        id: "req-showtime-1",
        ownerId: theaterOwnerUser.userId,
        theaterId: "theater-1",
        targetType: "CREATE_SHOWTIME",
        status: "PENDING",
        payload: {
          movieId: "movie-1",
          screenId: "screen-with-no-seats",
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 7200000).toISOString(),
          regularSeatPrice: 150,
          premiumSeatPrice: 250,
          vipSeatPrice: 400,
        },
      });

      (prisma as any).$transaction = async (fn: any) => {
        const fakeTx = {
          showtime: {
            create: async ({ data }: any) => {
              createdShowtime = data;
              return { id: "new-showtime-1", ...data };
            },
          },
          seatPricing: {
            createMany: async ({ data }: any) => {
              createdPricingCount = data.length;
              return { count: data.length };
            },
          },
          seat: {
            count: async () => 0, // screen currently has 0 seats
            createMany: async ({ data }: any) => {
              backfilledSeats = data;
              return { count: data.length };
            },
          },
          screen: {
            findUnique: async () => ({
              id: "screen-with-no-seats",
              name: "Audi 1",
              totalSeats: 60,
            }),
          },
          approvalRequest: {
            update: async ({ where, data }: any) => ({
              id: where.id,
              ...data,
            }),
          },
        };
        return await fn(fakeTx);
      };

      try {
        const approved = await ApprovalService.approveRequest(
          "req-showtime-1",
          adminUser.userId,
        );
        assert.strictEqual(approved.status, "APPROVED");
        assert.strictEqual(createdPricingCount, 3);
        assert.strictEqual(backfilledSeats.length, 60);
        assert.strictEqual(backfilledSeats[0].screenId, "screen-with-no-seats");
      } finally {
        (prisma.approvalRequest as any).findUnique = originalRequestFindUnique;
        (prisma as any).$transaction = originalTransaction;
      }
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 4: Public Boundary Protection
  // --------------------------------------------------------------------------
  describe("Suite 4: Public & AI Discovery Boundary Protection", () => {
    it("should filter out unapproved (PENDING or REJECTED) theaters from public discovery", async () => {
      const originalFindMany = prisma.theater.findMany;
      let capturedWhere: any = null;

      (prisma.theater as any).findMany = async ({ where }: any) => {
        capturedWhere = where;
        return [
          { id: "th-approved-1", name: "Approved Theater", status: "APPROVED" },
        ];
      };

      try {
        const theaters = await TheaterRepository.getTheaters();
        assert.deepStrictEqual(capturedWhere, { status: "APPROVED" });
        assert.strictEqual(theaters.length, 1);
        assert.strictEqual(theaters[0].status, "APPROVED");
      } finally {
        (prisma.theater as any).findMany = originalFindMany;
      }
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 5: Registration Role Differentiation
  // --------------------------------------------------------------------------
  describe("Suite 5: User & Theater Owner Registration Differentiation", () => {
    const { registerSchema } = require("../modules/auth/auth.validation");

    it("should accept THEATER_OWNER role upon registration", () => {
      const parsed = registerSchema.safeParse({
        name: "Cinema Manager",
        email: "owner@multiplex.com",
        password: "securePassword123",
        role: "THEATER_OWNER",
      });
      assert.strictEqual(parsed.success, true);
      if (parsed.success) {
        assert.strictEqual(parsed.data.role, "THEATER_OWNER");
      }
    });

    it("should default to USER role when role is omitted", () => {
      const parsed = registerSchema.safeParse({
        name: "John Doe",
        email: "john@cinema.com",
        password: "securePassword123",
      });
      assert.strictEqual(parsed.success, true);
      if (parsed.success) {
        assert.strictEqual(parsed.data.role, "USER");
      }
    });

    it("should strictly reject unauthorized roles (ADMIN, SUPER_ADMIN)", () => {
      const parsedAdmin = registerSchema.safeParse({
        name: "Hacker Admin",
        email: "hacker@cinema.com",
        password: "securePassword123",
        role: "ADMIN",
      });
      assert.strictEqual(parsedAdmin.success, false);

      const parsedSuperAdmin = registerSchema.safeParse({
        name: "Hacker SuperAdmin",
        email: "hacker@cinema.com",
        password: "securePassword123",
        role: "SUPER_ADMIN",
      });
      assert.strictEqual(parsedSuperAdmin.success, false);
    });
  });
});

