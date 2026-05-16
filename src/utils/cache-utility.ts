import { redis } from "../config/redis";

export const MOVIE_CACHE_TTL = 60 * 60 * 24; // 24 hours

export const CACHE_KEYS = {
  ALL_MOVIES: "movies:all",
  PAGINATED_MOVIES: "movies:page:*", 
  MOVIE_BY_ID: (id: string) => `movie:${id}`,
};


// This function will find every key starting with "movies:page:" and delete it
export const deleteByPattern = async (pattern: string) => {
  let cursor = "0";
  do {
    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = nextCursor;
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`Cleared ${keys.length} pagination keys`);
    }
  } while (cursor !== "0");
};
