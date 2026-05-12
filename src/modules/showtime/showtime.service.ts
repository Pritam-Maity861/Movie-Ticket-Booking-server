import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/api-error";
import { MovieRepository } from "../movie/movie.repository";
import { ScreenRepository } from "../screen/screen.repository";
import { ShowtimeRepository } from "./showtime.repository";
import { CreateShowtimeInput } from "./showtime.validation";

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

  static async getShowtimes(movieId: string, date: Date) {
    const showtimes = await ShowtimeRepository.getShowtimes(movieId, date);
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
    return showtime;
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
