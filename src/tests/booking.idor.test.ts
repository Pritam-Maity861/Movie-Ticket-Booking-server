import { describe, it } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { ENV } from "../config/env";
import { prisma } from "../config/prisma";
import { redis } from "../config/redis";
import { authMiddleware } from "../middleware/auth.middleware";
import { requireRoles } from "../middleware/role.middleware";
import { BookingService } from "../modules/booking/booking.service";
import {
  getBooking,
  getAllBookings,
} from "../modules/booking/booking.controller";
import { PaymentService } from "../modules/payment/payment.service";
import {
  getPaymentsById,
  getAllPayments,
} from "../modules/payment/payment.controller";
import { AuthUser } from "../types/express";
import { ApiError } from "../utils/api-error";

// Disconnect ioredis in sandbox environment
try {
  redis.disconnect();
} catch {}

describe("Bug 3: Booking & Payment IDOR Security Test Suite", () => {
  const jwtSecret = ENV.JWT_ACCESS_TOKEN_SECRET || "test_jwt_secret_key";

  const userAlice: AuthUser = {
    userId: "user_alice_111",
    role: "USER",
    email: "alice@test.com",
  };

  const userBob: AuthUser = {
    userId: "user_bob_222",
    role: "USER",
    email: "bob@test.com",
  };

  const adminUser: AuthUser = {
    userId: "user_admin_333",
    role: "ADMIN",
    email: "admin@test.com",
  };

  const superAdminUser: AuthUser = {
    userId: "user_superadmin_444",
    role: "SUPER_ADMIN",
    email: "superadmin@test.com",
  };

  // Helper to generate signed JWT tokens
  const createTestToken = (user: AuthUser): string => {
    return jwt.sign(
      { userId: user.userId, role: user.role, email: user.email },
      jwtSecret,
      { expiresIn: "1h" },
    );
  };

  // Helper to create mock Express request and response objects
  const createMockContext = (options: {
    headers?: Record<string, string>;
    params?: Record<string, string>;
    body?: any;
    user?: AuthUser;
  }) => {
    const req: any = {
      headers: options.headers || {},
      params: options.params || {},
      body: options.body || {},
      user: options.user,
    };

    let statusCode = 200;
    let responseData: any = null;

    const res: any = {
      status(code: number) {
        statusCode = code;
        return res;
      },
      json(data: any) {
        responseData = data;
        return res;
      },
    };

    return {
      req,
      res,
      getStatusCode: () => statusCode,
      getResponseData: () => responseData,
    };
  };

  // Helper to invoke asyncHandler-wrapped controllers and await resolution
  const invokeAsyncController = (
    controller: any,
    req: any,
    res: any,
  ): Promise<{ error?: any; data?: any }> => {
    return new Promise((resolve) => {
      const originalJson = res.json;
      res.json = (data: any) => {
        originalJson(data);
        resolve({ data });
        return res;
      };
      const next = (err?: any) => {
        resolve({ error: err });
      };
      controller(req, res, next);
    });
  };

  // Sample mock bookings
  const mockAliceBooking = {
    id: "booking_alice_999",
    userId: userAlice.userId,
    showtimeId: "showtime_1",
    totalAmount: 500,
    status: "CONFIRMED",
    seats: [],
    showtime: {
      movie: { title: "Inception" },
      screen: { theater: { name: "PVR" } },
    },
    payment: { id: "pay_alice_1", status: "SUCCESS" },
  };

  // --------------------------------------------------------------------------
  // SUITE 1: Authentication & RBAC Middleware Scoping
  // --------------------------------------------------------------------------
  describe("Suite 1: Authentication & Role Middleware Verification", () => {
    it("should return 401 when Authorization header is missing", () => {
      const { req, res, getStatusCode, getResponseData } = createMockContext({
        headers: {},
      });
      let nextCalled = false;
      authMiddleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(getStatusCode(), 401);
      assert.match(getResponseData().message, /No token provided/i);
    });

    it("should return 401 when token is invalid or tampered", () => {
      const { req, res, getStatusCode, getResponseData } = createMockContext({
        headers: { authorization: "Bearer invalid.token.signature" },
      });
      let nextCalled = false;
      authMiddleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(getStatusCode(), 401);
      assert.match(getResponseData().message, /Invalid token/i);
    });

    it("should decode valid token and attach typed AuthUser to req.user", () => {
      const token = createTestToken(userAlice);
      const { req, res } = createMockContext({
        headers: { authorization: `Bearer ${token}` },
      });
      let nextCalled = false;
      authMiddleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      assert.equal(req.user?.userId, userAlice.userId);
      assert.equal(req.user?.role, userAlice.role);
      assert.equal(req.user?.email, userAlice.email);
    });

    it("should reject normal USER role when endpoint requires ADMIN", () => {
      const { req, res } = createMockContext({ user: userAlice });
      const middleware = requireRoles(["ADMIN", "SUPER_ADMIN"]);

      let errorThrown: any = null;
      middleware(req, res, (err?: any) => {
        errorThrown = err;
      });

      assert.ok(errorThrown instanceof ApiError);
      assert.equal(errorThrown.statusCode, 403);
      assert.match(errorThrown.message, /Forbidden/i);
    });

    it("should allow ADMIN role when endpoint requires ADMIN", () => {
      const { req, res } = createMockContext({ user: adminUser });
      const middleware = requireRoles(["ADMIN", "SUPER_ADMIN"]);

      let nextCalled = false;
      let errorThrown: any = null;
      middleware(req, res, (err?: any) => {
        if (err) errorThrown = err;
        else nextCalled = true;
      });

      assert.equal(errorThrown, null);
      assert.equal(nextCalled, true);
    });

    it("should allow SUPER_ADMIN role when endpoint requires ADMIN", () => {
      const { req, res } = createMockContext({ user: superAdminUser });
      const middleware = requireRoles(["ADMIN", "SUPER_ADMIN"]);

      let nextCalled = false;
      let errorThrown: any = null;
      middleware(req, res, (err?: any) => {
        if (err) errorThrown = err;
        else nextCalled = true;
      });

      assert.equal(errorThrown, null);
      assert.equal(nextCalled, true);
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 2: Service-Level Database Scoping (getBookingByIdForUser)
  // --------------------------------------------------------------------------
  describe("Suite 2: Database-Level Scoping in BookingService", () => {
    it("should scope query with userId for normal USER and return booking if owned", async () => {
      let capturedWhere: any = null;
      const originalFindFirst = prisma.booking.findFirst;
      (prisma.booking.findFirst as any) = async (args: any) => {
        capturedWhere = args.where;
        return mockAliceBooking;
      };

      try {
        const booking = await BookingService.getBookingByIdForUser(
          "booking_alice_999",
          userAlice,
        );
        assert.ok(booking);
        assert.equal(capturedWhere.id, "booking_alice_999");
        assert.equal(capturedWhere.userId, userAlice.userId); // Enforced at DB level!
      } finally {
        prisma.booking.findFirst = originalFindFirst;
      }
    });

    it("should return null when a normal USER attempts to query another user's booking", async () => {
      let capturedWhere: any = null;
      const originalFindFirst = prisma.booking.findFirst;
      (prisma.booking.findFirst as any) = async (args: any) => {
        capturedWhere = args.where;
        return null;
      };

      try {
        const booking = await BookingService.getBookingByIdForUser(
          "booking_alice_999",
          userBob,
        );
        assert.equal(booking, null);
        assert.equal(capturedWhere.id, "booking_alice_999");
        assert.equal(capturedWhere.userId, userBob.userId);
      } finally {
        prisma.booking.findFirst = originalFindFirst;
      }
    });

    it("should NOT restrict query by userId when an ADMIN queries another user's booking", async () => {
      let capturedWhere: any = null;
      const originalFindFirst = prisma.booking.findFirst;
      (prisma.booking.findFirst as any) = async (args: any) => {
        capturedWhere = args.where;
        return mockAliceBooking;
      };

      try {
        const booking = await BookingService.getBookingByIdForUser(
          "booking_alice_999",
          adminUser,
        );
        assert.ok(booking);
        assert.equal(capturedWhere.id, "booking_alice_999");
        assert.equal(capturedWhere.userId, undefined); // No userId filter for ADMIN
      } finally {
        prisma.booking.findFirst = originalFindFirst;
      }
    });

    it("should NOT restrict query by userId when a SUPER_ADMIN queries another user's booking", async () => {
      let capturedWhere: any = null;
      const originalFindFirst = prisma.booking.findFirst;
      (prisma.booking.findFirst as any) = async (args: any) => {
        capturedWhere = args.where;
        return mockAliceBooking;
      };

      try {
        const booking = await BookingService.getBookingByIdForUser(
          "booking_alice_999",
          superAdminUser,
        );
        assert.ok(booking);
        assert.equal(capturedWhere.id, "booking_alice_999");
        assert.equal(capturedWhere.userId, undefined); // No userId filter for SUPER_ADMIN
      } finally {
        prisma.booking.findFirst = originalFindFirst;
      }
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 3: Controller-Level IDOR Prevention & Uniform 404 Responses
  // --------------------------------------------------------------------------
  describe("Suite 3: Booking Controller Authorization", () => {
    it("should return 200 when user accesses their own booking", async () => {
      const originalFindFirst = prisma.booking.findFirst;
      (prisma.booking.findFirst as any) = async () => mockAliceBooking;

      try {
        const { req, res, getStatusCode, getResponseData } = createMockContext({
          params: { id: "booking_alice_999" },
          user: userAlice,
        });

        const result = await invokeAsyncController(getBooking, req, res);
        assert.equal(getStatusCode(), 200);
        assert.equal(result.data.data.id, "booking_alice_999");
      } finally {
        prisma.booking.findFirst = originalFindFirst;
      }
    });

    it("should return 404 when user accesses another user's booking (preventing existence leak)", async () => {
      const originalFindFirst = prisma.booking.findFirst;
      (prisma.booking.findFirst as any) = async () => null; // Scoped query returns null

      try {
        const { req, res } = createMockContext({
          params: { id: "booking_alice_999" },
          user: userBob,
        });

        const result = await invokeAsyncController(getBooking, req, res);
        assert.ok(result.error instanceof ApiError);
        assert.equal(result.error.statusCode, 404);
        assert.equal(result.error.message, "Booking not found");
      } finally {
        prisma.booking.findFirst = originalFindFirst;
      }
    });

    it("should return 404 when querying a non-existent booking ID", async () => {
      const originalFindFirst = prisma.booking.findFirst;
      (prisma.booking.findFirst as any) = async () => null;

      try {
        const { req, res } = createMockContext({
          params: { id: "non_existent_id_999" },
          user: userAlice,
        });

        const result = await invokeAsyncController(getBooking, req, res);
        assert.ok(result.error instanceof ApiError);
        assert.equal(result.error.statusCode, 404);
        assert.equal(result.error.message, "Booking not found");
      } finally {
        prisma.booking.findFirst = originalFindFirst;
      }
    });

    it("should return 200 when ADMIN accesses another user's booking", async () => {
      const originalFindFirst = prisma.booking.findFirst;
      (prisma.booking.findFirst as any) = async () => mockAliceBooking;

      try {
        const { req, res, getStatusCode } = createMockContext({
          params: { id: "booking_alice_999" },
          user: adminUser,
        });

        const result = await invokeAsyncController(getBooking, req, res);
        assert.equal(getStatusCode(), 200);
        assert.equal(result.data.data.id, "booking_alice_999");
      } finally {
        prisma.booking.findFirst = originalFindFirst;
      }
    });

    it("should return 403 when a normal USER calls getAllBookings", async () => {
      const { req, res } = createMockContext({
        user: userAlice,
      });

      const result = await invokeAsyncController(getAllBookings, req, res);
      assert.ok(result.error instanceof ApiError);
      assert.equal(result.error.statusCode, 403);
      assert.match(result.error.message, /Forbidden/i);
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 4: Payment Scoping & Ownership Defense
  // --------------------------------------------------------------------------
  describe("Suite 4: Payment Endpoint Scoping & Ownership Defense", () => {
    const mockAlicePayment = {
      id: "pay_alice_123",
      userId: userAlice.userId,
      amount: 500,
      status: "SUCCESS",
      provider: "RAZORPAY",
      booking: mockAliceBooking,
    };

    it("should return 200 when user accesses their own payment details", async () => {
      const originalFindFirst = prisma.payment.findFirst;
      (prisma.payment.findFirst as any) = async () => mockAlicePayment;

      try {
        const { req, res, getStatusCode } = createMockContext({
          params: { id: "pay_alice_123" },
          user: userAlice,
        });

        const result = await invokeAsyncController(getPaymentsById, req, res);
        assert.equal(getStatusCode(), 200);
        assert.equal(result.data.data.id, "pay_alice_123");
      } finally {
        prisma.payment.findFirst = originalFindFirst;
      }
    });

    it("should return 404 when user tries accessing another user's payment details", async () => {
      const originalFindFirst = prisma.payment.findFirst;
      (prisma.payment.findFirst as any) = async () => null; // Scoped query returns null

      try {
        const { req, res } = createMockContext({
          params: { id: "pay_alice_123" },
          user: userBob,
        });

        const result = await invokeAsyncController(getPaymentsById, req, res);
        assert.ok(result.error instanceof ApiError);
        assert.equal(result.error.statusCode, 404);
        assert.equal(result.error.message, "Payment not found");
      } finally {
        prisma.payment.findFirst = originalFindFirst;
      }
    });

    it("should return 200 when ADMIN accesses another user's payment details", async () => {
      const originalFindFirst = prisma.payment.findFirst;
      (prisma.payment.findFirst as any) = async () => mockAlicePayment;

      try {
        const { req, res, getStatusCode } = createMockContext({
          params: { id: "pay_alice_123" },
          user: adminUser,
        });

        const result = await invokeAsyncController(getPaymentsById, req, res);
        assert.equal(getStatusCode(), 200);
        assert.equal(result.data.data.id, "pay_alice_123");
      } finally {
        prisma.payment.findFirst = originalFindFirst;
      }
    });

    it("should return 403 when a normal USER calls getAllPayments", async () => {
      const { req, res } = createMockContext({
        user: userAlice,
      });

      const result = await invokeAsyncController(getAllPayments, req, res);
      assert.ok(result.error instanceof ApiError);
      assert.equal(result.error.statusCode, 403);
      assert.match(result.error.message, /Forbidden/i);
    });
  });
});
