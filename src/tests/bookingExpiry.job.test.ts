import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../config/prisma";
import { redis } from "../config/redis";
import { redisServiceses } from "../services/seatLock.service";
import { processExpiredBookings } from "../jobs/bookingExpiry.job";
import { BookingService } from "../modules/booking/booking.service";
import { AuthUser } from "../types/express";

// Disconnect ioredis in sandbox environment
try {
  redis.disconnect();
} catch {}

describe("Bug 6: Soft Expiry & Booking Audit Preservation Test Suite", () => {
  const testUser: AuthUser = {
    userId: "user_audit_test_101",
    role: "USER",
    email: "audit@test.com",
  };

  const mockExpiredBooking = {
    id: "booking_expired_1",
    userId: testUser.userId,
    showtimeId: "showtime_alpha",
    status: "PENDING",
    expiresAt: new Date(Date.now() - 60000), // Expired 1 min ago
    totalAmount: 400,
    seats: [
      { id: "bs_1", seatId: "seat_A1", bookingId: "booking_expired_1" },
      { id: "bs_2", seatId: "seat_A2", bookingId: "booking_expired_1" },
    ],
  };

  // --------------------------------------------------------------------------
  // SUITE 1: Soft-Expiry without deleting bookingSeat rows
  // --------------------------------------------------------------------------
  describe("Suite 1: Soft-Expiry & Seat Audit Preservation", () => {
    it("should soft-expire pending bookings by setting status=EXPIRED without deleting bookingSeat rows", async () => {
      let updatedBookingId: string | null = null;
      let updatedStatus: string | null = null;
      let deleteManyCalled = false;

      const originalFindMany = prisma.booking.findMany;
      const originalUpdate = prisma.booking.update;
      const originalBookingSeatDeleteMany = prisma.bookingSeat.deleteMany;

      (prisma.booking.findMany as any) = async () => [mockExpiredBooking];
      (prisma.booking.update as any) = async (args: any) => {
        updatedBookingId = args.where.id;
        updatedStatus = args.data.status;
        return { ...mockExpiredBooking, status: updatedStatus };
      };
      (prisma.bookingSeat.deleteMany as any) = async () => {
        deleteManyCalled = true;
        return { count: 0 };
      };

      try {
        const count = await processExpiredBookings();

        assert.equal(count, 1);
        assert.equal(updatedBookingId, "booking_expired_1");
        assert.equal(updatedStatus, "EXPIRED");
        // Crucial verification: bookingSeat must NOT be deleted during expiry!
        assert.equal(
          deleteManyCalled,
          false,
          "bookingSeat records must be preserved for audit history!",
        );
      } finally {
        prisma.booking.findMany = originalFindMany;
        prisma.booking.update = originalUpdate;
        prisma.bookingSeat.deleteMany = originalBookingSeatDeleteMany;
      }
    });

    it("should release Redis hold locks for the expired seats", async () => {
      let releasedShowtimeId: string | null = null;
      let releasedSeatIds: string[] = [];

      const originalFindMany = prisma.booking.findMany;
      const originalUpdate = prisma.booking.update;
      const originalReleaseSeats = redisServiceses.releaseSeats;

      (prisma.booking.findMany as any) = async () => [mockExpiredBooking];
      (prisma.booking.update as any) = async () => ({
        ...mockExpiredBooking,
        status: "EXPIRED",
      });
      (redisServiceses.releaseSeats as any) = async (
        stId: string,
        sIds: string[],
      ) => {
        releasedShowtimeId = stId;
        releasedSeatIds = sIds;
      };

      try {
        await processExpiredBookings();

        assert.equal(releasedShowtimeId, "showtime_alpha");
        assert.deepEqual(releasedSeatIds, ["seat_A1", "seat_A2"]);
      } finally {
        prisma.booking.findMany = originalFindMany;
        prisma.booking.update = originalUpdate;
        redisServiceses.releaseSeats = originalReleaseSeats;
      }
    });

    it("should handle Redis release errors gracefully without crashing the cron", async () => {
      const originalFindMany = prisma.booking.findMany;
      const originalUpdate = prisma.booking.update;
      const originalReleaseSeats = redisServiceses.releaseSeats;

      (prisma.booking.findMany as any) = async () => [mockExpiredBooking];
      (prisma.booking.update as any) = async () => ({
        ...mockExpiredBooking,
        status: "EXPIRED",
      });
      (redisServiceses.releaseSeats as any) = async () => {
        throw new Error("Redis connection dropped");
      };

      try {
        const count = await processExpiredBookings();
        assert.equal(count, 1, "Must complete successfully despite Redis error");
      } finally {
        prisma.booking.findMany = originalFindMany;
        prisma.booking.update = originalUpdate;
        redisServiceses.releaseSeats = originalReleaseSeats;
      }
    });

    it("should return 0 when no expired bookings exist", async () => {
      const originalFindMany = prisma.booking.findMany;
      (prisma.booking.findMany as any) = async () => [];

      try {
        const count = await processExpiredBookings();
        assert.equal(count, 0);
      } finally {
        prisma.booking.findMany = originalFindMany;
      }
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 2: Audit Retrieval Verification
  // --------------------------------------------------------------------------
  describe("Suite 2: Expired Booking Audit Retrieval", () => {
    it("should allow customer or AI agent to retrieve seats attached to an EXPIRED booking", async () => {
      const fullExpiredBooking = {
        id: "booking_expired_1",
        userId: testUser.userId,
        showtimeId: "showtime_alpha",
        status: "EXPIRED",
        totalAmount: 400,
        seats: [
          {
            id: "bs_1",
            seatId: "seat_A1",
            seat: { id: "seat_A1", row: "A", seatNumber: 1, type: "REGULAR" },
          },
          {
            id: "bs_2",
            seatId: "seat_A2",
            seat: { id: "seat_A2", row: "A", seatNumber: 2, type: "REGULAR" },
          },
        ],
        showtime: {
          movie: { title: "Dune: Part Two" },
          screen: { theater: { name: "IMAX City" } },
          seatPricings: [],
        },
      };

      const originalFindFirst = prisma.booking.findFirst;
      (prisma.booking.findFirst as any) = async () => fullExpiredBooking;

      try {
        const result = await BookingService.getBookingByIdForUser(
          "booking_expired_1",
          testUser,
        );

        assert.ok(result);
        assert.equal(result.status, "EXPIRED");
        assert.equal(
          result.seats.length,
          2,
          "Expired booking must retain its selected seats for customer support!",
        );
        assert.equal(result.seats[0].seatId, "seat_A1");
        assert.equal(result.seats[1].seatId, "seat_A2");
      } finally {
        prisma.booking.findFirst = originalFindFirst;
      }
    });
  });
});

