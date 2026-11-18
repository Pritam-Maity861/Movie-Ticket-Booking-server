import { ENV } from "../../config/env";
import { prisma } from "../../config/prisma";
import { razorpay } from "../../config/razorpay";
import { redis } from "../../config/redis";
import { ApiError } from "../../utils/api-error";
import crypto from "crypto";
import { redisServiceses } from "../../services/seatLock.service";
import { PaymentRepository } from "./payment.repository";

/**
 * Timing-safe string comparison to prevent timing attacks
 */
export const timingSafeCompare = (a: string, b: string): boolean => {
  try {
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    if (bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
};

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

    //prevent duplicate order creation while preserving original orderId
    if (booking.payment?.providerRef) {
      const existingOrderId = booking.payment.providerRef.includes("|")
        ? booking.payment.providerRef.split("|")[0]
        : booking.payment.providerRef;

      return {
        orderId: existingOrderId,
        amount: booking.totalAmount * 100,
        key: ENV.RAZORPAY_KEY_ID,
        currency: "INR",
        checkoutUrl: `${ENV.CLIENT_URL}/checkout/${booking.id}`,
      };
    }

    //create order in razorpay
    const order = await razorpay.orders.create({
      amount: Math.round(booking.totalAmount * 100), //amount in paise(razorpay expects amount in smallest currency unit)
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
      checkoutUrl: `${ENV.CLIENT_URL}/checkout/${booking.id}`,
    };
  }

  /**
   * Unified, thread-safe, idempotent payment confirmation engine.
   * Shared by both the frontend verification endpoint and the Razorpay Webhook.
   */
  static async confirmPaymentSuccess(params: {
    orderId: string;
    paymentId: string;
    amountInPaise?: number;
    currency?: string;
    eventId?: string;
    source: "WEBHOOK" | "CLIENT_VERIFY";
  }) {
    const { orderId, paymentId, amountInPaise, currency, eventId, source } =
      params;

    // 1. Webhook Event Idempotency Check (Redis event caching)
    if (eventId) {
      const isAlreadyProcessed = await redis.get(`webhook:event:${eventId}`);
      if (isAlreadyProcessed) {
        console.log(
          `[Payment] Webhook event ${eventId} already processed. Skipping duplicate execution.`,
        );
        return {
          success: true,
          message: "Event already processed",
          duplicate: true,
        };
      }
    }

    // 2. Find Payment Record (matching orderId without losing it)
    const payment = await prisma.payment.findFirst({
      where: {
        OR: [
          { providerRef: orderId },
          { providerRef: { startsWith: `${orderId}|` } },
        ],
      },
      include: {
        booking: {
          include: {
            seats: true,
          },
        },
      },
    });

    if (!payment) {
      throw new ApiError(404, `Payment record not found for order ${orderId}`);
    }

    const booking = payment.booking;
    if (!booking) {
      throw new ApiError(
        404,
        `Associated booking not found for payment ${payment.id}`,
      );
    }

    // 3. Amount & Currency Validation
    if (amountInPaise !== undefined) {
      const expectedAmountInPaise = Math.round(booking.totalAmount * 100);
      if (amountInPaise !== expectedAmountInPaise) {
        throw new ApiError(
          400,
          `Payment amount mismatch: received ${amountInPaise} paise, expected ${expectedAmountInPaise} paise`,
        );
      }
    }

    if (currency && currency.toUpperCase() !== "INR") {
      throw new ApiError(
        400,
        `Unsupported currency: ${currency}. Only INR is accepted.`,
      );
    }

    // 4. Idempotency Check on DB State
    if (payment.status === "SUCCESS" && booking.status === "CONFIRMED") {
      console.log(
        `[Payment] Order ${orderId} already confirmed in DB. No duplicate action needed.`,
      );
      if (eventId) {
        await redis.set(`webhook:event:${eventId}`, "1", "EX", 86400);
      }
      return {
        success: true,
        message: "Booking already confirmed",
        alreadyConfirmed: true,
      };
    }

    // 5. Expired Booking Handling (Double-booking protection & auto-refund)
    if (booking.status === "EXPIRED") {
      console.warn(
        `[Payment] Booking ${booking.id} was marked EXPIRED. Checking if seats are still available...`,
      );

      const seatIds = booking.seats.map((s) => s.seatId);
      let seatsTaken = false;

      // If booking seats were deleted on expiry, seats were released back to inventory
      if (seatIds.length === 0) {
        seatsTaken = true;
      } else {
        const conflictingBookings = await prisma.bookingSeat.findMany({
          where: {
            showtimeId: booking.showtimeId,
            seatId: { in: seatIds },
            bookingId: { not: booking.id },
            booking: {
              status: "CONFIRMED",
            },
          },
        });
        if (conflictingBookings.length > 0) {
          seatsTaken = true;
        }
      }

      if (seatsTaken) {
        console.error(
          `[Payment] Booking ${booking.id} expired and seats were re-allocated to another customer! Auto-initiating refund for payment ${paymentId}...`,
        );

        let refundSuccess = false;
        if (paymentId && paymentId !== "N/A") {
          try {
            await razorpay.payments.refund(paymentId, {
              amount: Math.round(payment.amount * 100),
              notes: {
                reason:
                  "Booking expired and seats were re-allocated to another customer.",
              },
            });
            refundSuccess = true;
            console.log(
              `[Payment] Razorpay refund initiated successfully for payment ${paymentId}`,
            );
          } catch (refundErr) {
            console.error(
              `[Payment] Failed to trigger Razorpay refund for payment ${paymentId}:`,
              refundErr,
            );
          }
        }

        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: refundSuccess ? "REFUNDED" : "FAILED",
            providerRef:
              paymentId && paymentId !== "N/A"
                ? `${orderId}|${paymentId}`
                : payment.providerRef,
          },
        });

        return {
          success: false,
          refunded: refundSuccess,
          message:
            "Booking expired and seats are no longer available. Payment has been refunded.",
        };
      }

      console.log(
        `[Payment] Seats are still available for expired booking ${booking.id}. Reviving and confirming booking.`,
      );
    }

    // 6. Atomic Transaction to Prevent Race Conditions
    // Preserve Order ID while attaching Payment ID: `${orderId}|${paymentId}`
    const updatedBooking = await prisma.$transaction(async (tx) => {
      const updatedPaymentCount = await tx.payment.updateMany({
        where: {
          id: payment.id,
          status: "PENDING",
        },
        data: {
          status: "SUCCESS",
          providerRef:
            paymentId && paymentId !== "N/A"
              ? `${orderId}|${paymentId}`
              : payment.providerRef,
        },
      });

      if (updatedPaymentCount.count === 0 && payment.status !== "PENDING") {
        // Another concurrent request (e.g. webhook vs /payments/verify) already updated this payment
        return null;
      }

      return await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: "CONFIRMED",
        },
        include: {
          seats: true,
        },
      });
    });

    // 7. Non-blocking Redis Lock Release (Isolated Failure Domain)
    if (updatedBooking && updatedBooking.seats.length > 0) {
      try {
        const seatIds = updatedBooking.seats.map((s) => s.seatId);
        await redisServiceses.releaseSeats(
          updatedBooking.showtimeId,
          seatIds,
        );
      } catch (redisErr) {
        console.error(
          `[Payment] Failed to release Redis locks for showtime ${updatedBooking.showtimeId} (non-fatal, TTL will clean up):`,
          redisErr,
        );
      }
    }

    // 8. Record Webhook Event Deduplication in Redis
    if (eventId) {
      try {
        await redis.set(`webhook:event:${eventId}`, "1", "EX", 86400);
      } catch (redisErr) {
        console.warn(
          "[Payment] Failed to store eventId deduplication key in Redis:",
          redisErr,
        );
      }
    }

    // 9. Structured Secure Logging
    console.log(
      `[Payment] Confirmed successfully | Source=${source} | OrderId=${orderId} | PaymentId=${paymentId} | BookingId=${booking.id} | Amount=${booking.totalAmount}`,
    );

    return {
      success: true,
      bookingId: booking.id,
      status: "CONFIRMED",
    };
  }

  static async verifyRazorpayPayment(data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = data;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new ApiError(400, "Missing required payment verification fields");
    }

    // Verify signature using timing-safe comparison
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", ENV.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest("hex");

    if (!timingSafeCompare(expectedSignature, razorpay_signature)) {
      throw new ApiError(400, "Invalid payment signature");
    }

    return await this.confirmPaymentSuccess({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      source: "CLIENT_VERIFY",
    });
  }

  static async getAllPayments() {
    const paymentsData = await PaymentRepository.getAllPayments();
    if (!paymentsData || paymentsData.length === 0) {
      throw new ApiError(404, "No payments found");
    }
    return paymentsData;
  }
  static async getPaymentByID(paymentId: string) {
    if (!paymentId) {
      throw new ApiError(400, "Payment ID is required");
    }
    const paymentsData = await PaymentRepository.getPaymentsByID(paymentId);
    if (!paymentsData) {
      throw new ApiError(404, "Payment data not found");
    }
    return paymentsData;
  }
}
