import Redis from "ioredis";
import { ENV } from "./env";

export const redis = new Redis(ENV.UPSTASH_REDIS_URL!,{
  maxRetriesPerRequest:3,
   enableReadyCheck: true,
   tls:{},
   
});

redis.on("connect", () => {
  console.log("Redis connected");
});

redis.on("error", (err) => {
  console.log("Redis error", err);
});