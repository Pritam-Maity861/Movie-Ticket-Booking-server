import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { ENV } from "../config/env";
import {
  PaymentService,
  timingSafeCompare,
} from "../modules/payment/payment.service";
import { handleRazorpayWebhook } from "../modules/payment/payment.webhook";
import { prisma } from "../config/prisma";
import { redis } from "../config/redis";
import { razorpay } from "../config/razorpay";

// Disconnect ioredis from trying to reach Upstash over the sandbox network
try {
  redis.disconnect();
} catch {}

describe("Razorpay Payment & Webhook Integration Test Suite", () => {
  const testWebhookSecret = ENV.RAZORPAY_WEBHOOK_SECRET || "test_webhook_secret_key";

  // Helper to generate HMAC SHA256 signature
  const generateSignature = (payload: any, secret = testWebhookSecret): string => {
    const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
    return crypto.createHmac("sha256", secret).update(raw).digest("hex");
  };

  // Helper to create mock Express request and response objects
  const createMockContext = (options: {
    headers?: Record<string, string>;
    rawBody?: Buffer;
    body?: any;
  }) => {
    const req: any = {
      headers: options.headers || {},
      rawBody:
        options.rawBody ||
        (options.body ? Buffer.from(JSON.stringify(options.body)) : undefined),
      body: options.body || {},
    };

    let statusCode = 200;
    let responseData: any = null;

    const res: any = {
      status(code: number) {
        statusCode = code;
        return res;
      },
      json(data: any) {
        responseData = data;
        return res;
      },
    };

    return {
      req,
      res,
      getStatusCode: () => statusCode,
      getResponseData: () => responseData,
    };
  };

  // --------------------------------------------------------------------------
  // SUITE 1: HTTP Webhook Handler & Signature Verification
  // --------------------------------------------------------------------------
  describe("Suite 1: Webhook Handler & Signature Verification", () => {
    it("should return 400 when x-razorpay-signature header is missing", async () => {
      const { req, res, getStatusCode, getResponseData } = createMockContext({
        headers: {},
        body: { event: "payment.captured" },
      });

      await handleRazorpayWebhook(req, res);

      assert.equal(getStatusCode(), 400);
      assert.match(getResponseData().message, /Missing Razorpay signature/i);
    });

    it("should return 400 when x-razorpay-signature is invalid or tampered", async () => {
      const body = { event: "payment.captured" };
      const { req, res, getStatusCode, getResponseData } = createMockContext({
        headers: {
          "x-razorpay-signature":
            "invalid_forged_signature_hex_1234567890abcdef",
        },
        body,
      });

      await handleRazorpayWebhook(req, res);

      assert.equal(getStatusCode(), 400);
      assert.match(getResponseData().message, /Invalid webhook signature/i);
    });

    it("should return 400 when signature was computed with a different secret", async () => {
      const body = { event: "payment.captured" };
      const wrongSignature = generateSignature(body, "wrong_secret_key_999");

      const { req, res, getStatusCode, getResponseData } = createMockContext({
        headers: {
          "x-razorpay-signature": wrongSignature,
        },
        body,
      });

      await handleRazorpayWebhook(req, res);

      assert.equal(getStatusCode(), 400);
      assert.match(getResponseData().message, /Invalid webhook signature/i);
    });

    it("should safely acknowledge unhandled events with 200 without crashing", async () => {
      const body = { event: "payout.processed", payload: {} };
      const validSig = generateSignature(body);

      const { req, res, getStatusCode, getResponseData } = createMockContext({
        headers: {
          "x-razorpay-signature": validSig,
        },
        body,
      });

      await handleRazorpayWebhook(req, res);

      assert.equal(getStatusCode(), 200);
      assert.equal(getResponseData().status, "unhandled_event_acknowledged");
    });

    it("should ignore payment events where status is not captured with 200 OK", async () => {
      const body = {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_test_uncaptured",
              order_id: "order_test_uncaptured",
              status: "authorized", // Not yet captured
            },
          },
        },
      };
      const validSig = generateSignature(body);

      const { req, res, getStatusCode, getResponseData } = createMockContext({
        headers: {
          "x-razorpay-signature": validSig,
        },
        body,
      });

      await handleRazorpayWebhook(req, res);

      assert.equal(getStatusCode(), 200);
      assert.equal(getResponseData().status, "ignored_not_captured");
    });

    it("should successfully process a validly signed payment.captured webhook", async () => {
      const originalConfirm = PaymentService.confirmPaymentSuccess;
      let confirmCalledWith: any = null;

      (PaymentService.confirmPaymentSuccess as any) = async (params: any) => {
        confirmCalledWith = params;
        return { success: true, bookingId: "bk_1", status: "CONFIRMED" };
      };

      const body = {
        event: "payment.captured",
        event_id: "evt_webhook_valid_123",
        payload: {
          payment: {
            entity: {
              id: "pay_valid_123",
              order_id: "order_valid_456",
              amount: 50000,
              currency: "INR",
              status: "captured",
            },
          },
        },
      };
      const validSig = generateSignature(body);

      const { req, res, getStatusCode, getResponseData } = createMockContext({
        headers: {
          "x-razorpay-signature": validSig,
        },
        body,
      });

      try {
        await handleRazorpayWebhook(req, res);

        assert.equal(getStatusCode(), 200);
        assert.equal(getResponseData().status, "ok");
        assert.equal(confirmCalledWith.orderId, "order_valid_456");
        assert.equal(confirmCalledWith.paymentId, "pay_valid_123");
        assert.equal(confirmCalledWith.amountInPaise, 50000);
        assert.equal(confirmCalledWith.currency, "INR");
        assert.equal(confirmCalledWith.source, "WEBHOOK");
      } finally {
        PaymentService.confirmPaymentSuccess = originalConfirm;
      }
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 2: Cryptographic Timing-Safe Comparison
  // --------------------------------------------------------------------------
  describe("Suite 2: Timing-Safe Comparison (timingSafeCompare)", () => {
    it("should return true for identical strings", () => {
      const secret = "a9b8c7d6e5f4a9b8c7d6e5f4";
      assert.equal(timingSafeCompare(secret, secret), true);
    });

    it("should return false for different strings of equal length", () => {
      const s1 = "a9b8c7d6e5f4a9b8c7d6e5f4";
      const s2 = "a9b8c7d6e5f4a9b8c7d6e5f5";
      assert.equal(timingSafeCompare(s1, s2), false);
    });

    it("should return false for strings of different lengths without throwing", () => {
      const s1 = "short";
      const s2 = "very_long_string_12345";
      assert.equal(timingSafeCompare(s1, s2), false);
    });

    it("should handle empty strings safely", () => {
      assert.equal(timingSafeCompare("", ""), true);
      assert.equal(timingSafeCompare("", "not_empty"), false);
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 3: Business Logic, State Machine & Concurrency Tests
  // --------------------------------------------------------------------------
  describe("Suite 3: PaymentService State Machine & Race Condition Protection", () => {
    const mockOrderId = "order_test_integration_123";
    const mockPaymentId = "pay_test_integration_456";
    const mockBookingId = "booking_test_uuid_789";

    it("should validate and reject payment with amount mismatch", async () => {
      const originalFindFirst = prisma.payment.findFirst;
      (prisma.payment.findFirst as any) = async () => ({
        id: "pmt_1",
        status: "PENDING",
        providerRef: mockOrderId,
        amount: 500,
        booking: {
          id: mockBookingId,
          totalAmount: 500,
          status: "PENDING",
          seats: [{ seatId: "seat_1" }],
        },
      });

      try {
        await assert.rejects(
          PaymentService.confirmPaymentSuccess({
            orderId: mockOrderId,
            paymentId: mockPaymentId,
            amountInPaise: 30000, // Mismatched amount (300 instead of 500)
            currency: "INR",
            source: "WEBHOOK",
          }),
          (err: any) => {
            assert.equal(err.statusCode, 400);
            assert.match(err.message, /Payment amount mismatch/i);
            return true;
          }
        );
      } finally {
        prisma.payment.findFirst = originalFindFirst;
      }
    });

    it("should validate and reject payment with unsupported currency", async () => {
      const originalFindFirst = prisma.payment.findFirst;
      (prisma.payment.findFirst as any) = async () => ({
        id: "pmt_1",
        status: "PENDING",
        providerRef: mockOrderId,
        amount: 500,
        booking: {
          id: mockBookingId,
          totalAmount: 500,
          status: "PENDING",
          seats: [{ seatId: "seat_1" }],
        },
      });

      try {
        await assert.rejects(
          PaymentService.confirmPaymentSuccess({
            orderId: mockOrderId,
            paymentId: mockPaymentId,
            amountInPaise: 50000,
            currency: "USD", // Unsupported currency
            source: "WEBHOOK",
          }),
          (err: any) => {
            assert.equal(err.statusCode, 400);
            assert.match(err.message, /Unsupported currency/i);
            return true;
          }
        );
      } finally {
        prisma.payment.findFirst = originalFindFirst;
      }
    });

    it("should preserve Order ID when attaching Payment ID (never overwriting order_id)", async () => {
      const originalFindFirst = prisma.payment.findFirst;
      const originalTransaction = prisma.$transaction;
      let recordedProviderRef = "";

      (prisma.payment.findFirst as any) = async () => ({
        id: "pmt_1",
        status: "PENDING",
        providerRef: mockOrderId,
        amount: 500,
        booking: {
          id: mockBookingId,
          totalAmount: 500,
          status: "PENDING",
          showtimeId: "st_1",
          seats: [{ seatId: "seat_1" }],
        },
      });

      (prisma.$transaction as any) = async (callback: any) => {
        return callback({
          payment: {
            updateMany: async (args: any) => {
              recordedProviderRef = args.data.providerRef;
              return { count: 1 };
            },
          },
          booking: {
            update: async () => ({
              id: mockBookingId,
              status: "CONFIRMED",
              showtimeId: "st_1",
              seats: [{ seatId: "seat_1" }],
            }),
          },
        });
      };

      try {
        const result = await PaymentService.confirmPaymentSuccess({
          orderId: mockOrderId,
          paymentId: mockPaymentId,
          amountInPaise: 50000,
          currency: "INR",
          source: "CLIENT_VERIFY",
        });

        assert.equal(result.success, true);
        assert.equal(result.status, "CONFIRMED");
        // Verify Order ID is preserved and payment ID appended
        assert.equal(recordedProviderRef, `${mockOrderId}|${mockPaymentId}`);
        assert.equal(recordedProviderRef.startsWith(mockOrderId), true);
      } finally {
        prisma.payment.findFirst = originalFindFirst;
        prisma.$transaction = originalTransaction;
      }
    });

    it("should handle duplicate webhook delivery idempotently via Redis event caching", async () => {
      const eventId = "evt_test_dedup_999";
      const originalRedisGet = redis.get;
      (redis.get as any) = async (key: string) => {
        if (key === `webhook:event:${eventId}`) return "1";
        return null;
      };

      try {
        const result = await PaymentService.confirmPaymentSuccess({
          orderId: mockOrderId,
          paymentId: mockPaymentId,
          eventId,
          source: "WEBHOOK",
        });

        assert.equal(result.success, true);
        assert.equal(result.duplicate, true);
        assert.equal(result.message, "Event already processed");
      } finally {
        redis.get = originalRedisGet;
      }
    });

    it("should handle duplicate DB state gracefully (already confirmed)", async () => {
      const originalFindFirst = prisma.payment.findFirst;
      (prisma.payment.findFirst as any) = async () => ({
        id: "pmt_1",
        status: "SUCCESS",
        providerRef: `${mockOrderId}|${mockPaymentId}`,
        amount: 500,
        booking: {
          id: mockBookingId,
          totalAmount: 500,
          status: "CONFIRMED",
          seats: [{ seatId: "seat_1" }],
        },
      });

      try {
        const result = await PaymentService.confirmPaymentSuccess({
          orderId: mockOrderId,
          paymentId: mockPaymentId,
          amountInPaise: 50000,
          currency: "INR",
          source: "WEBHOOK",
        });

        assert.equal(result.success, true);
        assert.equal(result.alreadyConfirmed, true);
      } finally {
        prisma.payment.findFirst = originalFindFirst;
      }
    });

    it("should prevent race condition when /payments/verify and /payments/webhook execute simultaneously", async () => {
      const originalFindFirst = prisma.payment.findFirst;
      const originalTransaction = prisma.$transaction;
      let executionCount = 0;

      (prisma.payment.findFirst as any) = async () => ({
        id: "pmt_1",
        status: "PENDING",
        providerRef: mockOrderId,
        amount: 500,
        booking: {
          id: mockBookingId,
          totalAmount: 500,
          status: "PENDING",
          showtimeId: "st_1",
          seats: [{ seatId: "seat_1" }],
        },
      });

      (prisma.$transaction as any) = async (callback: any) => {
        executionCount++;
        // First execution succeeds (count: 1); second concurrent execution finds count: 0 (already updated)
        const updatedCount = executionCount === 1 ? 1 : 0;
        return callback({
          payment: {
            updateMany: async () => ({ count: updatedCount }),
          },
          booking: {
            update: async () => ({
              id: mockBookingId,
              status: "CONFIRMED",
              showtimeId: "st_1",
              seats: [{ seatId: "seat_1" }],
            }),
          },
        });
      };

      try {
        // Run both calls in parallel
        const [res1, res2] = await Promise.all([
          PaymentService.confirmPaymentSuccess({
            orderId: mockOrderId,
            paymentId: mockPaymentId,
            amountInPaise: 50000,
            currency: "INR",
            source: "CLIENT_VERIFY",
          }),
          PaymentService.confirmPaymentSuccess({
            orderId: mockOrderId,
            paymentId: mockPaymentId,
            amountInPaise: 50000,
            currency: "INR",
            source: "WEBHOOK",
          }),
        ]);

        assert.equal(res1.success, true);
        assert.equal(res2.success, true);
        assert.equal(executionCount, 2);
      } finally {
        prisma.payment.findFirst = originalFindFirst;
        prisma.$transaction = originalTransaction;
      }
    });

    it("should detect expired booking with seat conflict, halt confirmation, and auto-refund", async () => {
      const originalFindFirst = prisma.payment.findFirst;
      const originalBookingSeatFindMany = prisma.bookingSeat.findMany;
      const originalRefund = razorpay.payments.refund;
      const originalPaymentUpdate = prisma.payment.update;

      let refundTriggered = false;
      let recordedStatus = "";

      (prisma.payment.findFirst as any) = async () => ({
        id: "pmt_1",
        status: "PENDING",
        providerRef: mockOrderId,
        amount: 500,
        booking: {
          id: mockBookingId,
          totalAmount: 500,
          status: "EXPIRED", // Booking was expired by cron
          showtimeId: "st_1",
          seats: [{ seatId: "seat_conflict_1" }],
        },
      });

      // Mock that another customer booked seat_conflict_1 with CONFIRMED status
      (prisma.bookingSeat.findMany as any) = async () => [
        {
          id: "bs_other_customer",
          seatId: "seat_conflict_1",
          bookingId: "other_booking_id_999",
          booking: { status: "CONFIRMED" },
        },
      ];

      (razorpay.payments.refund as any) = async () => {
        refundTriggered = true;
        return { id: "rfnd_test_123" };
      };

      (prisma.payment.update as any) = async (args: any) => {
        recordedStatus = args.data.status;
        return args.data;
      };

      try {
        const result = await PaymentService.confirmPaymentSuccess({
          orderId: mockOrderId,
          paymentId: mockPaymentId,
          amountInPaise: 50000,
          currency: "INR",
          source: "WEBHOOK",
        });

        assert.equal(result.success, false);
        assert.equal(result.refunded, true);
        assert.equal(refundTriggered, true);
        assert.equal(recordedStatus, "REFUNDED");
        assert.match(result.message, /seats are no longer available.*refunded/i);
      } finally {
        prisma.payment.findFirst = originalFindFirst;
        prisma.bookingSeat.findMany = originalBookingSeatFindMany;
        razorpay.payments.refund = originalRefund;
        prisma.payment.update = originalPaymentUpdate;
      }
    });

    it("should revive and confirm expired booking if seats are still available", async () => {
      const originalFindFirst = prisma.payment.findFirst;
      const originalBookingSeatFindMany = prisma.bookingSeat.findMany;
      const originalTransaction = prisma.$transaction;

      (prisma.payment.findFirst as any) = async () => ({
        id: "pmt_1",
        status: "PENDING",
        providerRef: mockOrderId,
        amount: 500,
        booking: {
          id: mockBookingId,
          totalAmount: 500,
          status: "EXPIRED", // Expired, but nobody took the seats
          showtimeId: "st_1",
          seats: [{ seatId: "seat_free_1" }],
        },
      });

      // No conflicting bookings found
      (prisma.bookingSeat.findMany as any) = async () => [];

      (prisma.$transaction as any) = async (callback: any) => {
        return callback({
          payment: {
            updateMany: async () => ({ count: 1 }),
          },
          booking: {
            update: async () => ({
              id: mockBookingId,
              status: "CONFIRMED",
              showtimeId: "st_1",
              seats: [{ seatId: "seat_free_1" }],
            }),
          },
        });
      };

      try {
        const result = await PaymentService.confirmPaymentSuccess({
          orderId: mockOrderId,
          paymentId: mockPaymentId,
          amountInPaise: 50000,
          currency: "INR",
          source: "WEBHOOK",
        });

        assert.equal(result.success, true);
        assert.equal(result.status, "CONFIRMED");
      } finally {
        prisma.payment.findFirst = originalFindFirst;
        prisma.bookingSeat.findMany = originalBookingSeatFindMany;
        prisma.$transaction = originalTransaction;
      }
    });

    it("should ensure Redis errors do not roll back confirmed database transaction", async () => {
      const originalFindFirst = prisma.payment.findFirst;
      const originalTransaction = prisma.$transaction;
      const originalRedisDel = redis.del;

      (prisma.payment.findFirst as any) = async () => ({
        id: "pmt_1",
        status: "PENDING",
        providerRef: mockOrderId,
        amount: 500,
        booking: {
          id: mockBookingId,
          totalAmount: 500,
          status: "PENDING",
          showtimeId: "st_1",
          seats: [{ seatId: "seat_1" }],
        },
      });

      (prisma.$transaction as any) = async (callback: any) => {
        return callback({
          payment: {
            updateMany: async () => ({ count: 1 }),
          },
          booking: {
            update: async () => ({
              id: mockBookingId,
              status: "CONFIRMED",
              showtimeId: "st_1",
              seats: [{ seatId: "seat_1" }],
            }),
          },
        });
      };

      // Mock Redis throwing a connection error
      (redis.del as any) = async () => {
        throw new Error("Upstash Redis connection timeout");
      };

      try {
        const result = await PaymentService.confirmPaymentSuccess({
          orderId: mockOrderId,
          paymentId: mockPaymentId,
          amountInPaise: 50000,
          currency: "INR",
          source: "CLIENT_VERIFY",
        });

        // Booking must STILL be confirmed successfully despite Redis error!
        assert.equal(result.success, true);
        assert.equal(result.status, "CONFIRMED");
      } finally {
        prisma.payment.findFirst = originalFindFirst;
        prisma.$transaction = originalTransaction;
        redis.del = originalRedisDel;
      }
    });
  });
});
