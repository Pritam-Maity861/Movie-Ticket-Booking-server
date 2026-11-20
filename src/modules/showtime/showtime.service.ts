import { prisma } from "../../config/prisma";
import { redis } from "../../config/redis";
import { ApiError } from "../../utils/api-error";
import { MovieRepository } from "../movie/movie.repository";
import { ScreenRepository } from "../screen/screen.repository";
import { ShowtimeRepository } from "./showtime.repository";
import { CreateShowtimeInput } from "./showtime.validation";
import { generateSeatGrid } from "../screen/screen.utils";

export class ShowtimeService {
  static async createShowtime(data: CreateShowtimeInput) {
    const {
      movieId,
      screenId,
      startTime,
      premiumSeatPrice,
      regularSeatPrice,
      vipSeatPrice,
    } = data;

    const movie = await MovieRepository.getMovieById(movieId);
    if (!movie) {
      throw new ApiError(404, "Movie not found");
    }

    const screen = await ScreenRepository.getScreenById(screenId);
    if (!screen) {
      throw new ApiError(404, "Screen not found");
    }
    if (startTime < new Date()) {
      throw new ApiError(400, "Start time must be in the future");
    }

    const endTime = new Date(startTime.getTime() + movie.duration * 60 * 1000);

    const overlap = await ShowtimeRepository.checkOverlap(
      screenId,
      startTime,
      endTime,
    );
    if (overlap) {
      throw new ApiError(
        400,
        "Showtime overlaps with an existing showtime on this screen",
      );
    }

    const showtime = await prisma.$transaction(async (tx) => {
      const createdShowtime = await tx.showtime.create({
        data: {
          movieId,
          screenId,
          startTime,
          endTime,
        },
      });
      await tx.seatPricing.createMany({
        data: [
          {
            showtimeId: createdShowtime.id,
            seatType: "REGULAR",
            price: regularSeatPrice,
          },
          {
            showtimeId: createdShowtime.id,
            seatType: "PREMIUM",
            price: premiumSeatPrice,
          },
          {
            showtimeId: createdShowtime.id,
            seatType: "VIP",
            price: vipSeatPrice,
          },
        ],
      });
      return createdShowtime;
    });

    // const updateSeatPrice = await ScreenRepository.updateSeatPrice(
    //   premiumSeatPrice,
    //   regularSeatPrice,
    //   vipSeatPrice,
    //   showtime.id as string,
    // );

    return showtime;
  }

  static async getShowtimes(movieId: string, date: Date, theaterId?: string) {
    const showtimes = await ShowtimeRepository.getShowtimes(
      movieId,
      date,
      theaterId,
    );
    const theaterMap = new Map();

    for (const show of showtimes) {
      const theater = show.screen.theater;
      const screen = show.screen;

      if (!theaterMap.has(theater.id)) {
        theaterMap.set(theater.id, {
          theaterId: theater.id,
          theaterName: theater.name,
          screens: [],
          // seats: screen.seats,
          city: theater.city,
          address: theater.address,
          ratting: theater.ratting,
        });
      }

      const theaterEntry = theaterMap.get(theater.id);

      let screenEntry = theaterEntry.screens.find(
        (s: any) => s.screenId === screen.id,
      );

      if (!screenEntry) {
        screenEntry = {
          screenId: screen.id,
          screenName: screen.name,
          showtimes: [],
        };
        theaterEntry.screens.push(screenEntry);
      }

      screenEntry.showtimes.push({
        showtimeId: show.id,
        startTime: show.startTime,
        endTime: show.endTime,
      });
    }

    return Array.from(theaterMap.values());
  }

  static async getShowtimeById(id: string) {
    const showtime = await ShowtimeRepository.getShowtimeById(id);
    if (!showtime) {
      throw new ApiError(404, "Showtime not found");
    }

    // Auto-generate default seats if screen currently has 0 seats
    if (showtime.screen && (!showtime.screen.seats || showtime.screen.seats.length === 0)) {
      const generated = generateSeatGrid(
        showtime.screen.id,
        showtime.screen.totalSeats || 100,
      );
      if (generated.length > 0) {
        await prisma.seat.createMany({
          data: generated,
          skipDuplicates: true,
        });
        showtime.screen.seats = await prisma.seat.findMany({
          where: { screenId: showtime.screen.id },
          orderBy: [{ row: "asc" }, { number: "asc" }],
        });
      }
    }

    const bookedSeatIds = new Set<string>();
    const lockedSeatIds = new Set<string>();

    // 1. Process DB bookings
    if (showtime.bookingSeats) {
      const now = new Date();
      for (const bs of showtime.bookingSeats) {
        if (bs.booking.status === "CONFIRMED") {
          bookedSeatIds.add(bs.seatId);
        } else if (
          bs.booking.status === "PENDING" &&
          bs.booking.expiresAt &&
          new Date(bs.booking.expiresAt) > now
        ) {
          lockedSeatIds.add(bs.seatId);
        }
      }
    }

    // 2. Process active Redis seat locks
    if (showtime.screen?.seats && showtime.screen.seats.length > 0) {
      const allSeatIds = showtime.screen.seats.map((s) => s.id);
      const redisKeys = allSeatIds.map(
        (seatId) => `lock:showtime:${id}:seat:${seatId}`,
      );
      if (redisKeys.length > 0) {
        const lockValues = await redis.mget(...redisKeys);
        lockValues.forEach((val, idx) => {
          if (val !== null) {
            const seatId = allSeatIds[idx];
            if (!bookedSeatIds.has(seatId)) {
              lockedSeatIds.add(seatId);
            }
          }
        });
      }
    }

    return {
      ...showtime,
      bookedSeatIds: Array.from(bookedSeatIds),
      lockedSeatIds: Array.from(lockedSeatIds),
    };
  }

  /**
   * Unified real-time seat availability map combining DB status + Redis locks.
   * Returns standardized { seatId, row, number, type, price, status: 'AVAILABLE' | 'HELD' | 'BOOKED' }
   */
  static async getShowtimeSeatAvailability(showtimeId: string) {
    if (!showtimeId) {
      throw new ApiError(400, "Showtime ID is required");
    }

    const showtime = await prisma.showtime.findUnique({
      where: { id: showtimeId },
      include: {
        screen: {
          include: {
            theater: true,
            seats: { orderBy: [{ row: "asc" }, { number: "asc" }] },
          },
        },
        seatPricings: true,
        bookingSeats: {
          where: {
            booking: {
              OR: [
                { status: "CONFIRMED" },
                { status: "PENDING", expiresAt: { gt: new Date() } },
              ],
            },
          },
          include: { booking: true },
        },
      },
    });

    if (!showtime) {
      throw new ApiError(404, "Showtime not found");
    }

    // Auto-generate default seats if screen currently has 0 seats
    let screenSeats = showtime.screen?.seats || [];
    if (showtime.screen && screenSeats.length === 0) {
      const generated = generateSeatGrid(
        showtime.screen.id,
        showtime.screen.totalSeats || 100,
      );
      if (generated.length > 0) {
        await prisma.seat.createMany({
          data: generated,
          skipDuplicates: true,
        });
        screenSeats = await prisma.seat.findMany({
          where: { screenId: showtime.screen.id },
          orderBy: [{ row: "asc" }, { number: "asc" }],
        });
      }
    }

    // Build pricing map
    const pricingMap = new Map(
      showtime.seatPricings.map((p) => [p.seatType, p.price]),
    );

    // Build DB booked/held maps
    const bookedSeatIds = new Set<string>();
    const dbHeldSeatIds = new Set<string>();

    for (const bs of showtime.bookingSeats) {
      if (bs.booking.status === "CONFIRMED") {
        bookedSeatIds.add(bs.seatId);
      } else if (bs.booking.status === "PENDING") {
        dbHeldSeatIds.add(bs.seatId);
      }
    }

    // Check Redis locks (non-fatal if Redis connection is unavailable)
    const redisHeldSeatIds = new Set<string>();
    try {
      const seatKeys = screenSeats.map(
        (s) => `lock:showtime:${showtimeId}:seat:${s.id}`,
      );
      if (seatKeys.length > 0) {
        const redisLockValues = await redis.mget(...seatKeys);
        screenSeats.forEach((seat, idx) => {
          if (redisLockValues && redisLockValues[idx] !== null) {
            redisHeldSeatIds.add(seat.id);
          }
        });
      }
    } catch (redisErr) {
      console.warn(
        `[ShowtimeService] Warning: Could not read Redis locks for showtime ${showtimeId} (falling back to DB state):`,
        redisErr,
      );
    }

    // Assemble unified layout
    const seatLayout = screenSeats.map((seat) => {
      let status: "AVAILABLE" | "HELD" | "BOOKED" = "AVAILABLE";

      if (bookedSeatIds.has(seat.id)) {
        status = "BOOKED";
      } else if (dbHeldSeatIds.has(seat.id) || redisHeldSeatIds.has(seat.id)) {
        status = "HELD";
      }

      return {
        seatId: seat.id,
        row: seat.row,
        number: seat.number,
        type: seat.type,
        price: pricingMap.get(seat.type) || 0,
        status,
      };
    });

    return {
      showtimeId: showtime.id,
      movieId: showtime.movieId,
      theaterName: showtime.screen.theater.name,
      screenName: showtime.screen.name,
      startTime: showtime.startTime,
      endTime: showtime.endTime,
      totalSeats: showtime.screen.totalSeats,
      availableSeatsCount: seatLayout.filter((s) => s.status === "AVAILABLE")
        .length,
      seats: seatLayout,
    };
  }

  static async getShowtimesByScreenId(screenId: string) {
    return await ShowtimeRepository.getShowtimesByScreenId(screenId);
  }

  static async deleteShowtime(id: string) {
    const showtime = await ShowtimeRepository.getShowtimeById(id);
    if (!showtime) {
      throw new ApiError(404, "Showtime not found");
    }

    // Optional: Check if there are confirmed bookings before deleting
    // const hasConfirmedBookings = showtime.bookings.some(b => b.status === 'CONFIRMED');
    // if (hasConfirmedBookings) {
    //   throw new ApiError(400, "Cannot delete showtime with confirmed bookings");
    // }

    return await ShowtimeRepository.deleteShowtime(id);
  }
}
