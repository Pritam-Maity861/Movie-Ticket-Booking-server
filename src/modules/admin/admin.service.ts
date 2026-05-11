import { prisma } from "../../config/prisma";

export class AdminService {
  static async getDashboardStats() {
    const [movieCount, bookingCount, userCount, theaterCount, totalRevenue] =
      await Promise.all([
        prisma.movie.count(),
        prisma.booking.count({
          where: {
            status: "CONFIRMED",
          },
        }),
        prisma.user.count(),
        prisma.theater.count(),
        prisma.booking.aggregate({
          where: {
            status: "CONFIRMED",
          },
          _sum: {
            totalAmount: true,
          },
        }),
      ]);

    // Get recent bookings
    const recentBookings = await prisma.booking.findMany({
      take: 5,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        showtime: {
          include: {
            movie: true,
          },
        },
      },
    });

    return {
      stats: {
        movies: movieCount,
        bookings: bookingCount,
        users: userCount,
        theaters: theaterCount,
        revenue: totalRevenue._sum.totalAmount || 0,
      },
      recentBookings,
    };
  }

  static async getAllUsers() {
    return await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        profilePicUrl: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  static async updateUserRole(userId: string, role: any) {
    return await prisma.user.update({
      where: { id: userId },
      data: { role },
    });
  }

  static async deleteUser(userId: string) {
    return await prisma.user.delete({
      where: { id: userId },
    });
  }
}
