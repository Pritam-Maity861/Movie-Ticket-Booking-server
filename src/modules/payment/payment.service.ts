import { success } from "zod";
import { ENV } from "../../config/env";
import { prisma } from "../../config/prisma";
import { razorpay } from "../../config/razorpay";
import { ApiError } from "../../utils/api-error";
import crypto from "crypto";
import { redisServiceses } from "../../services/seatLock.service";

export class PaymentService {
  static async createRazorpayOrder(bookingId: string, userId: string) {
    //create order for existing booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    });
    if (!booking) {
      throw new ApiError(404, "Booking not found");
    }

    if (booking.userId !== userId) {
      throw new ApiError(403, "Unauthorized");
    }

    if (booking.status !== "PENDING") {
      throw new ApiError(400, "Booking not valid for payment");
    }

    //prevent duplicate order creation
    if (booking.payment?.providerRef) {
      return {
        orderId: booking.payment.providerRef,
        amount: booking.totalAmount * 100,
        key: ENV.RAZORPAY_KEY_ID,
      };
    }

    //create order in razorpay
    const order = await razorpay.orders.create({
      amount: Math.round(booking.totalAmount * 100), //amount in paise(rezorpay expects amount in smallest currency unit)
      currency: "INR",
      receipt: booking.id,
    });

    //Create or update payment record
    if (!booking.payment) {
      await prisma.payment.create({
        data: {
          bookingId,
          userId,
          providerRef: order.id,
          amount: booking.totalAmount,
          status: "PENDING",
          provider: "RAZORPAY",
        },
      });
    } else {
      await prisma.payment.update({
        where: { id: booking.payment.id },
        data: {
          providerRef: order.id,
          amount: booking.totalAmount,
          status: "PENDING",
          provider: "RAZORPAY",
        },
      });
    }

    return {
      orderId: order.id,
      amount: booking.totalAmount * 100,
      key: ENV.RAZORPAY_KEY_ID,
      currency: order.currency,
    };
  }

  static async verifyRazorpayPayment(data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = data;

    //verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id; //razorpay expects this format for signature verification

    const excepectedSignature = crypto
      .createHmac("sha256", ENV.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest("hex");

    if (excepectedSignature !== razorpay_signature) {
      throw new ApiError(400, "Invalid payment signature");
    }

    //find payment
    const payment = await prisma.payment.findFirst({
      where: { providerRef: razorpay_order_id },
    });

    if (!payment) {
      throw new ApiError(404, "Payment record not found");
    }

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          providerRef: razorpay_payment_id,
          status: "SUCCESS",
        },
      });

      //update booking status to CONFIRMED
      await tx.booking.update({
        where: { id: payment.bookingId },
        data: {
          status: "CONFIRMED",
        },
      });
    });

    const bookingSeats=await prisma.bookingSeat.findMany({
        where:{bookingId:payment.bookingId}
    });
    //after payment confirmation release the locked seats in redis so that they can be removed from locked seats and added to booked seats in db
    redisServiceses.releaseSeats(payment.bookingId,bookingSeats.map(s=>s.seatId));

    return{
        success:true
    }
  }
}
