import app from "./app";
import { redis } from "./config/redis";
import { startBookingExpiryJob } from "./jobs/bookingExpiry.job";
import { AuthRepository } from "./modules/auth/auth.repository";
const PORT = process.env.PORT || 3000;

AuthRepository.cleanUpRefreshTokens();

//corn job run in every 1 min and check booking expiry and release lock and update booking status to expired if not paid
startBookingExpiryJob();

const startServer=async()=>{
  try {
  app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
} catch (error) {
  console.log("redis connection failed!!!",error)
}
}

startServer();
