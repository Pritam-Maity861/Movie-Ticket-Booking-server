import { prisma } from "../../config/prisma";
import { redis } from "../../config/redis";
import { redisServiceses } from "../../services/seatLock.service";
import { ApiError } from "../../utils/api-error";

export class BookingService {
  static async createPendingBooking(
  userId: string,
  showtimeId: string,
  seatIds: string[],
) {
  //Lock seats in Redis
  const locked = await redisServiceses.lockSeatsInRedis(
    showtimeId,
    seatIds,
    userId,
  );

  if (!locked) {
    throw new ApiError(
      409,
      "One or more seats are currently held by another user.",
    );
  }

  try {
    //Fetch showtime (OUTSIDE transaction)
    const showtime = await prisma.showtime.findUnique({
      where: { id: showtimeId },
      include: {
        screen: true,
        seatPricings: true,
      },
    });

    if (!showtime) {
      throw new ApiError(404, "Showtime not found");
    }

    //Fetch seats (OUTSIDE transaction)
    const screenSeats = await prisma.seat.findMany({
      where: {
        id: { in: seatIds },
        screenId: showtime.screenId,
      },
    });

    if (screenSeats.length !== seatIds.length) {
      throw new ApiError(400, "Some seats are invalid for this showtime");
    }

    //Calculate price (OUTSIDE transaction)
    const pricingMap = new Map(
      showtime.seatPricings.map((p) => [p.seatType, p.price]),
    );

    let totalAmount = 0;
    for (const seat of screenSeats) {
      const price = pricingMap.get(seat.type);
      if (!price) {
        throw new ApiError(400, `Price not found for seat ${seat.id}`);
      }
      totalAmount += price;
    }

    const EXPIRY_MINUTES = 10;
    const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000);

    //SMALL transaction (ONLY critical operations)
    const booking = await prisma.$transaction(async (tx) => {
      //Check already booked seats
      const alreadyBooked = await tx.bookingSeat.findMany({
        where: {
          showtimeId,
          seatId: { in: seatIds },
          booking: {
            status: { in: ["PENDING", "CONFIRMED"] },
          },
        },
        include: {
          booking: true,
        },
      });

      const conflict = alreadyBooked.some((bs) => {
        if (bs.booking.status === "CONFIRMED") return true;
        return (
          bs.booking.status === "PENDING" &&
          bs.booking.expiresAt &&
          bs.booking.expiresAt > new Date()
        );
      });

      if (conflict) {
        throw new ApiError(
          409,
          "Some seats are already booked or held by another user.",
        );
      }

      // REMOVED deleteMany (avoid locks + slowdown)

      // Create booking
      const newBooking = await tx.booking.create({
        data: {
          userId,
          showtimeId,
          totalAmount,
          expiresAt,
        },
      });

      //Create booking seats
      await tx.bookingSeat.createMany({
        data: seatIds.map((s) => ({
          bookingId: newBooking.id,
          seatId: s,
          showtimeId,
        })),
      });

      return newBooking;
    });

    //Fetch full booking
    return await prisma.booking.findUnique({
      where: { id: booking.id },
      include: {
        seats: {
          include: {
            seat: true,
          },
        },
        showtime: {
          include: {
            movie: true,
            screen: {
              include: {
                theater: true,
              },
            },
          },
        },
      },
    });
  } catch (error) {
    //Release Redis locks if anything fails
    const keys = seatIds.map(
      (id) => `lock:showtime:${showtimeId}:seat:${id}`,
    );
    await redis.del(...keys);

    throw error;
  }
}

  static async getUserBookings(userId: string) {
    return await prisma.booking.findMany({
      where: {
        userId,
      },
      include: {
        seats: {
          include: {
            seat: true,
          },
        },
        showtime: {
          include: {
            movie: true,
            screen: {
              include: {
                theater: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  static async getBookingById(id: string) {
    return await prisma.booking.findUnique({
      where: {
        id,
      },
      include: {
        seats: {
          include: {
            seat: true,
          },
        },
        showtime: {
          include: {
            movie: true,
            screen: {
              include: {
                theater: true,
              },
            },
            seatPricings: true,
          },
        },
      },
    });
  }
}
