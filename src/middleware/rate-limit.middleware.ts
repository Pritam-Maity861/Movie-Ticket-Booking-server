import rateLimit from "express-rate-limit";

export const bookingRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 15, // Limit each IP to 15 booking attempts per 10-minute window
  message: {
    success: false,
    errorCode: "RATE_LIMIT_EXCEEDED",
    message:
      "Too many booking requests from this IP. Please wait a few minutes before trying again.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

