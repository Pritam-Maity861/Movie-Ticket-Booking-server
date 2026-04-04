import { prisma } from "../../config/prisma";

export class ShowtimeRepository {
  //   static async createShowTime(data: {
  //     movieId: string;
  //     screenId: string;
  //     startTime: Date;
  //     endTime: Date;
  //   }) {
  //     return prisma.showtime.create({
  //       data: {
  //         movieId: data.movieId,
  //         screenId: data.screenId,
  //         startTime: data.startTime,
  //         endTime: data.endTime,
  //       },
  //     });
  //   }

  static async checkOverlap(screenId: string, startTime: Date, endTime: Date) {
    return prisma.showtime.findFirst({
      where: {
        screenId,
        OR: [
          {
            AND: [
              { startTime: { lte: startTime } },
              { endTime: { gt: startTime } },
            ],
          },
          {
            AND: [
              { startTime: { lt: endTime } },
              { endTime: { gte: endTime } },
            ],
          },
          {
            AND: [
              { startTime: { gte: startTime } },
              { endTime: { lte: endTime } },
            ],
          },
        ],
      },
    });
  }

  static async getShowtimes(movieId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    return prisma.showtime.findMany({
      where: {
        movieId,
        startTime: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
      include: {
        screen: {
          include: {
            theater: true,
            seats: true,
          },
        },
      },
      orderBy: {
        startTime: "asc",
      },
    });
  }

  static async getShowtimeById(id: string) {
    return prisma.showtime.findUnique({
      where: {
        id,
      },
      include: {
        movie: true,
        screen: {
          include: {
            theater: true,
            seats: {
              orderBy: [{ row: "asc" }, { number: "asc" }],
            },
          },
        },
        bookingSeats: true,
        seatPricings: true,
      },
    });
  }
}
