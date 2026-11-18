import cron from "node-cron";
import { prisma } from "../config/prisma";
import { redisServiceses } from "../services/seatLock.service";

/**
 * Core business logic for processing expired bookings.
 * Soft-expires stale PENDING bookings and releases Redis locks.
 * Does NOT delete bookingSeat records, preserving full audit history.
 */
export const processExpiredBookings = async (cutoffDate: Date = new Date()) => {
  try {
    // 1. Find all PENDING bookings whose expiresAt is past the cutoff date
    const expiredBookings = await prisma.booking.findMany({
      where: {
        status: "PENDING",
        expiresAt: {
          lt: cutoffDate,
        },
      },
      include: {
        seats: true,
      },
    });

    if (!expiredBookings || expiredBookings.length === 0) {
      return 0;
    }

    console.log(
      `[Booking Expiry Job] Found ${expiredBookings.length} expired booking(s) to process.`,
    );

    // 2. Process each booking: soft-expire in DB and release Redis seat locks
    for (const booking of expiredBookings) {
      try {
        const seatIds = booking.seats.map((s) => s.seatId);

        // Soft-expire: update status to EXPIRED without deleting bookingSeat rows
        await prisma.booking.update({
          where: { id: booking.id },
          data: { status: "EXPIRED" },
        });

        // Release temporary Redis hold locks
        if (seatIds.length > 0) {
          try {
            await redisServiceses.releaseSeats(booking.showtimeId, seatIds);
          } catch (redisErr) {
            console.warn(
              `[Booking Expiry Job] Non-fatal: Failed to release Redis lock for showtime ${booking.showtimeId}:`,
              redisErr,
            );
          }
        }

        console.log(
          `[Booking Expiry Job] Successfully soft-expired booking ${booking.id} (${seatIds.length} seats preserved for audit).`,
        );
      } catch (bookingErr) {
        console.error(
          `[Booking Expiry Job] Error expiring booking ${booking.id}:`,
          bookingErr,
        );
      }
    }

    return expiredBookings.length;
  } catch (error) {
    console.error(
      "[Booking Expiry Job] Critical error in booking expiry cycle:",
      error,
    );
    throw error;
  }
};

/**
 * Starts the recurring background cron job.
 * Runs once every 1 minute.
 */
export const startBookingExpiryJob = () => {
  cron.schedule("*/1 * * * *", async () => {
    console.log("[Booking Expiry Job] Checking for expired bookings...");
    try {
      await processExpiredBookings();
    } catch (err) {
      console.error("[Booking Expiry Job] Uncaught error during cycle:", err);
    }
  });
};
