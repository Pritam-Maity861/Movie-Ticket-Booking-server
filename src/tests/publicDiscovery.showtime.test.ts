import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { redis } from "../config/redis";
import showtimeRouter from "../modules/showtime/showtime.routes";

// Disconnect ioredis in sandbox environment
try {
  redis.disconnect();
} catch {}
import theaterRouter from "../theaters/theaters.routes";
import movieRouter from "../modules/movie/movie.route";
import screenRouter from "../modules/screen/screen.routes";
import { getShowtimes } from "../modules/showtime/showtime.controller";
import { ShowtimeService } from "../modules/showtime/showtime.service";
import { ApiError } from "../utils/api-error";

describe("Section B: Public Discovery & RESTful Showtimes API Test Suite", () => {
  const createMockContext = (options: {
    query?: Record<string, string>;
    body?: any;
    params?: Record<string, string>;
  }) => {
    const req: any = {
      query: options.query || {},
      body: options.body || {},
      params: options.params || {},
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

  const invokeAsyncController = (
    controller: any,
    req: any,
    res: any,
  ): Promise<{ error?: any; data?: any }> => {
    return new Promise((resolve) => {
      const originalJson = res.json;
      res.json = (data: any) => {
        originalJson(data);
        resolve({ data });
        return res;
      };
      const next = (err?: any) => {
        resolve({ error: err });
      };
      controller(req, res, next);
    });
  };

  // --------------------------------------------------------------------------
  // SUITE 1: Route Inspection for Public Discovery Access
  // --------------------------------------------------------------------------
  describe("Suite 1: Public Read Endpoints Verification", () => {
    it("should allow GET /theaters without authMiddleware", () => {
      const getRoute: any = theaterRouter.stack.find(
        (l: any) => l.route && l.route.path === "/" && l.route.methods.get,
      );
      assert.ok(getRoute, "GET / must exist on theaterRouter");
      assert.equal(getRoute.route.stack.length, 1);
    });

    it("should allow GET /theaters/:id without authMiddleware", () => {
      const getByIdRoute: any = theaterRouter.stack.find(
        (l: any) => l.route && l.route.path === "/:id" && l.route.methods.get,
      );
      assert.ok(getByIdRoute, "GET /:id must exist on theaterRouter");
      assert.equal(getByIdRoute.route.stack.length, 1);
    });

    it("should allow GET /movie/get-genre without authMiddleware", () => {
      const genreRoute: any = movieRouter.stack.find(
        (l: any) =>
          l.route && l.route.path === "/get-genre" && l.route.methods.get,
      );
      assert.ok(genreRoute, "GET /get-genre must exist on movieRouter");
      assert.equal(genreRoute.route.stack.length, 1);
    });

    it("should allow GET /movie/get-language without authMiddleware", () => {
      const langRoute: any = movieRouter.stack.find(
        (l: any) =>
          l.route && l.route.path === "/get-language" && l.route.methods.get,
      );
      assert.ok(langRoute, "GET /get-language must exist on movieRouter");
      assert.equal(langRoute.route.stack.length, 1);
    });

    it("should allow GET /screen/screens without authMiddleware", () => {
      const screenRoute: any = screenRouter.stack.find(
        (l: any) =>
          l.route && l.route.path === "/screens" && l.route.methods.get,
      );
      assert.ok(screenRoute, "GET /screens must exist on screenRouter");
      assert.equal(screenRoute.route.stack.length, 1);
    });

    it("should register public GET /showtime and GET /showtime/:id", () => {
      const getShowtimesRoute: any = showtimeRouter.stack.find(
        (l: any) => l.route && l.route.path === "/" && l.route.methods.get,
      );
      const getShowtimeByIdRoute: any = showtimeRouter.stack.find(
        (l: any) => l.route && l.route.path === "/:id" && l.route.methods.get,
      );

      assert.ok(getShowtimesRoute, "GET / must exist on showtimeRouter");
      assert.equal(getShowtimesRoute.route.stack.length, 1);

      assert.ok(getShowtimeByIdRoute, "GET /:id must exist on showtimeRouter");
      assert.equal(getShowtimeByIdRoute.route.stack.length, 1);
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 2: RESTful Query-Based Showtimes API
  // --------------------------------------------------------------------------
  describe("Suite 2: RESTful Query-Based Showtimes Handler", () => {
    const mockShowtimes = [
      {
        theaterId: "th_1",
        theaterName: "Cinepolis",
        city: "Mumbai",
        screens: [
          {
            screenId: "sc_1",
            screenName: "Screen 1",
            showtimes: [
              {
                showtimeId: "st_1",
                startTime: new Date("2026-11-20T10:00:00Z"),
                endTime: new Date("2026-11-20T12:30:00Z"),
              },
            ],
          },
        ],
      },
    ];

    it("should fetch showtimes via GET query parameters (?movieId=&date=)", async () => {
      let passedMovieId: string = "";
      let passedDate: any = null;
      let passedTheaterId: string | undefined = undefined;

      const originalGetShowtimes = ShowtimeService.getShowtimes;
      (ShowtimeService.getShowtimes as any) = async (
        mId: string,
        d: Date,
        thId?: string,
      ) => {
        passedMovieId = mId;
        passedDate = d;
        passedTheaterId = thId;
        return mockShowtimes;
      };

      try {
        const { req, res, getStatusCode, getResponseData } = createMockContext({
          query: {
            movieId: "movie_interstellar_1",
            date: "2026-11-20",
          },
        });

        const result = await invokeAsyncController(getShowtimes, req, res);

        assert.equal(getStatusCode(), 200);
        assert.equal(passedMovieId, "movie_interstellar_1");
        assert.ok(passedDate instanceof Date);
        assert.equal(passedDate.toISOString().split("T")[0], "2026-11-20");
        assert.equal(passedTheaterId, undefined);
        assert.equal(result.data.data.length, 1);
      } finally {
        ShowtimeService.getShowtimes = originalGetShowtimes;
      }
    });

    it("should pass optional theaterId query parameter when supplied", async () => {
      let passedTheaterId: string | undefined = undefined;

      const originalGetShowtimes = ShowtimeService.getShowtimes;
      (ShowtimeService.getShowtimes as any) = async (
        _mId: string,
        _d: Date,
        thId?: string,
      ) => {
        passedTheaterId = thId;
        return mockShowtimes;
      };

      try {
        const { req, res } = createMockContext({
          query: {
            movieId: "movie_interstellar_1",
            date: "2026-11-20",
            theaterId: "theater_pvr_city",
          },
        });

        await invokeAsyncController(getShowtimes, req, res);
        assert.equal(passedTheaterId, "theater_pvr_city");
      } finally {
        ShowtimeService.getShowtimes = originalGetShowtimes;
      }
    });

    it("should return 400 when movieId is missing", async () => {
      const { req, res } = createMockContext({
        query: { date: "2026-11-20" },
      });

      const result = await invokeAsyncController(getShowtimes, req, res);
      assert.ok(result.error instanceof ApiError);
      assert.equal(result.error.statusCode, 400);
      assert.match(result.error.message, /movieId and date are required/i);
    });

    it("should return 400 when date is invalid format", async () => {
      const { req, res } = createMockContext({
        query: { movieId: "m_1", date: "invalid-date-format" },
      });

      const result = await invokeAsyncController(getShowtimes, req, res);
      assert.ok(result.error instanceof ApiError);
      assert.equal(result.error.statusCode, 400);
      assert.match(result.error.message, /Invalid date format/i);
    });

    it("should support legacy POST request body for backward compatibility", async () => {
      let passedMovieId = "";

      const originalGetShowtimes = ShowtimeService.getShowtimes;
      (ShowtimeService.getShowtimes as any) = async (mId: string) => {
        passedMovieId = mId;
        return mockShowtimes;
      };

      try {
        const { req, res, getStatusCode } = createMockContext({
          body: {
            movieId: "movie_legacy_body_123",
            date: "2026-11-20",
          },
        });

        await invokeAsyncController(getShowtimes, req, res);
        assert.equal(getStatusCode(), 200);
        assert.equal(passedMovieId, "movie_legacy_body_123");
      } finally {
        ShowtimeService.getShowtimes = originalGetShowtimes;
      }
    });
  });
});
