import app from "./app";
import { redis } from "./config/redis";
import { AuthRepository } from "./modules/auth/auth.repository";
const PORT = process.env.PORT || 3000;

AuthRepository.cleanUpRefreshTokens();

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
