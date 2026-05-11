import { prisma } from "../../config/prisma";

export class BookingRepository {
  static getAllBookings() {
    return prisma.booking.findMany({
      include: {
        user: true,
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
      orderBy: {
        createdAt: "desc",
      },
    });
  }
}
