import corn from "node-cron";
import { prisma } from "../config/prisma";
import { redisServiceses } from "../services/seatLock.service";

//create a corn job for start booking expiry job after 10 min of every created booking,its run background in every 1 min.
export const startBookingExpiryJob = () => {
  corn.schedule("*/1 * * * *", async () => {
    console.log("Running booking expiry job...");

    const expiredBooking = await prisma.booking.findMany({
      where: {
        status: "PENDING",
        expiresAt: {
          lt: new Date(),
        },
      },
      include: {
        seats: true,
      },
    });

    for (const booking of expiredBooking) {
      const seatIds = booking.seats.map((s) => s.seatId);

      // Use transaction to ensure both status update and seat release/cleanup happen
      await prisma.$transaction([
        prisma.booking.update({
          where: { id: booking.id },
          data: { status: "EXPIRED" },
        }),
        // Delete bookingSeats so those seats become available for other users to book
        prisma.bookingSeat.deleteMany({
          where: { bookingId: booking.id },
        }),
      ]);

      await redisServiceses.releaseSeats(booking.showtimeId, seatIds);
      console.log(`Expired booking: ${booking.id} and released seats`);
    }
  });
};
