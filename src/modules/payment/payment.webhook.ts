import { Request, Response } from "express";
import crypto from "crypto";
import { ENV } from "../../config/env";
import { PaymentService, timingSafeCompare } from "./payment.service";

export const handleRazorpayWebhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-razorpay-signature"] as string;
    if (!signature) {
      console.warn("[Razorpay Webhook] Missing x-razorpay-signature header");
      return res
        .status(400)
        .json({ message: "Missing Razorpay signature header" });
    }

    const webhookSecret = ENV.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error(
        "[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is not configured on server",
      );
      return res
        .status(500)
        .json({ message: "Webhook secret not configured" });
    }

    const rawBody =
      req.rawBody || Buffer.from(JSON.stringify(req.body));

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    // Timing-safe signature comparison
    if (!timingSafeCompare(expectedSignature, signature)) {
      console.error("[Razorpay Webhook] Invalid webhook signature detected");
      return res.status(400).json({ message: "Invalid webhook signature" });
    }

    const event = req.body?.event;
    const eventId =
      req.body?.event_id ||
      (req.headers["x-razorpay-event-id"] as string | undefined);

    console.log(
      `[Razorpay Webhook] Received event: ${event} | EventID: ${eventId || "N/A"}`,
    );

    if (event === "payment.captured" || event === "order.paid") {
      const paymentEntity = req.body?.payload?.payment?.entity;
      const orderEntity = req.body?.payload?.order?.entity;

      const orderId = paymentEntity?.order_id || orderEntity?.id;
      const paymentId = paymentEntity?.id;
      const amount = paymentEntity?.amount || orderEntity?.amount;
      const currency = paymentEntity?.currency || orderEntity?.currency;
      const paymentStatus = paymentEntity?.status;

      if (!orderId) {
        console.warn("[Razorpay Webhook] Missing order_id in webhook payload");
        return res.status(200).json({ status: "ignored_missing_order_id" });
      }

      if (paymentStatus && paymentStatus !== "captured") {
        console.log(
          `[Razorpay Webhook] Payment ${paymentId} status is ${paymentStatus}, not captured. Skipping confirmation.`,
        );
        return res.status(200).json({ status: "ignored_not_captured" });
      }

      // Delegate to unified confirmation service
      const result = await PaymentService.confirmPaymentSuccess({
        orderId,
        paymentId: paymentId || "N/A",
        amountInPaise: amount,
        currency,
        eventId,
        source: "WEBHOOK",
      });

      return res.status(200).json({ status: "ok", result });
    } else if (event === "payment.failed") {
      console.warn(
        `[Razorpay Webhook] Payment failed for payment ID: ${req.body?.payload?.payment?.entity?.id}`,
      );
      return res.status(200).json({ status: "payment_failed_recorded" });
    }

    // Safely acknowledge unhandled events with 200 so Razorpay does not retry
    return res.status(200).json({ status: "unhandled_event_acknowledged" });
  } catch (error: any) {
    console.error("[Razorpay Webhook] Error processing webhook:", error);
    // Return 500 so Razorpay retries temporary server or network failures
    return res
      .status(500)
      .json({ message: error.message || "Internal server error" });
  }
};
