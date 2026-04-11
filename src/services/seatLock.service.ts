import { redis } from "../config/redis";

//reids look seat helper function
export class redisServiceses {
  static async lockSeatsInRedis(
    showtimeId: string,
    seatIds: string[],
    userId: string,
  ): Promise<boolean> {
    const expairy = 600; //10 min
    const lockedKeys: string[] = [];
    for (const seatId of seatIds) {
      const key = `lock:showtime:${showtimeId}:seat:${seatId}`;
      const res = await redis.set(key, userId, "EX", expairy, "NX");
      if (res !== "OK") {
        if (lockedKeys.length > 0) {
          await redis.del(...lockedKeys);
        }
        return false;
      }
      lockedKeys.push(key);
    }
    return true;
  }


  //releasing lock from redis
  static async releaseSeats(showtimeId: string, seatIds: string[]) {
    const keys = seatIds.map((id) => `lock:showtime:${showtimeId}:seat:${id}`);
    await redis.del(...keys);
  }
}
