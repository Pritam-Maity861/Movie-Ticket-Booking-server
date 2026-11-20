import test, { describe, it } from "node:test";
import assert from "node:assert";
import { ShowtimeService } from "../modules/showtime/showtime.service";
import { MovieService } from "../modules/movie/movie.service";
import { prisma } from "../config/prisma";
import { redis } from "../config/redis";

// Disconnect real redis in mock/unit test environment to avoid DNS errors
try {
  redis.disconnect();
} catch {}

describe("Change 3 & Change 4: Seat Availability & Multi-Criteria Movie Search", () => {
  describe("Change 3: Showtime Seat Availability Map (ShowtimeService.getShowtimeSeatAvailability)", () => {
    it("should return unified seat map with AVAILABLE, HELD, and BOOKED statuses and pricing", async () => {
      // Mock prisma.showtime.findUnique
      const originalFindUnique = prisma.showtime.findUnique;
      (prisma.showtime as any).findUnique = async ({ where }: any) => {
        if (where.id === "showtime-101") {
          return {
            id: "showtime-101",
            movieId: "movie-abc",
            startTime: new Date("2026-12-01T18:00:00Z"),
            endTime: new Date("2026-12-01T20:30:00Z"),
            screen: {
              name: "Audi 1",
              totalSeats: 3,
              theater: { name: "PVR Cinemas" },
              seats: [
                { id: "seat-1", row: "A", number: 1, type: "REGULAR" },
                { id: "seat-2", row: "A", number: 2, type: "PREMIUM" },
                { id: "seat-3", row: "A", number: 3, type: "VIP" },
              ],
            },
            seatPricings: [
              { seatType: "REGULAR", price: 150 },
              { seatType: "PREMIUM", price: 250 },
              { seatType: "VIP", price: 400 },
            ],
            bookingSeats: [
              {
                seatId: "seat-1",
                booking: { status: "CONFIRMED" },
              },
              {
                seatId: "seat-2",
                booking: {
                  status: "PENDING",
                  expiresAt: new Date(Date.now() + 10 * 60 * 1000), // active pending hold
                },
              },
            ],
          };
        }
        return null;
      };

      try {
        const result = await ShowtimeService.getShowtimeSeatAvailability("showtime-101");
        assert.strictEqual(result.showtimeId, "showtime-101");
        assert.strictEqual(result.theaterName, "PVR Cinemas");
        assert.strictEqual(result.screenName, "Audi 1");
        assert.strictEqual(result.totalSeats, 3);
        assert.strictEqual(result.availableSeatsCount, 1);
        assert.strictEqual(result.seats.length, 3);

        const seat1 = result.seats.find((s) => s.seatId === "seat-1");
        assert.strictEqual(seat1?.status, "BOOKED");
        assert.strictEqual(seat1?.price, 150);

        const seat2 = result.seats.find((s) => s.seatId === "seat-2");
        assert.strictEqual(seat2?.status, "HELD");
        assert.strictEqual(seat2?.price, 250);

        const seat3 = result.seats.find((s) => s.seatId === "seat-3");
        assert.strictEqual(seat3?.status, "AVAILABLE");
        assert.strictEqual(seat3?.price, 400);
      } finally {
        (prisma.showtime as any).findUnique = originalFindUnique;
      }
    });

    it("should throw 404 ApiError if showtime does not exist", async () => {
      const originalFindUnique = prisma.showtime.findUnique;
      (prisma.showtime as any).findUnique = async () => null;

      try {
        await assert.rejects(
          async () => {
            await ShowtimeService.getShowtimeSeatAvailability("non-existent-id");
          },
          (err: any) => {
            assert.strictEqual(err.statusCode, 404);
            assert.strictEqual(err.message, "Showtime not found");
            return true;
          },
        );
      } finally {
        (prisma.showtime as any).findUnique = originalFindUnique;
      }
    });
  });

  describe("Change 4: Multi-Criteria Movie Search & Filtering (MovieService.getAllMovies)", () => {
    it("should pass search, genreId, languageId, page and limit to movie repository", async () => {
      const originalCount = prisma.movie.count;
      const originalFindMany = prisma.movie.findMany;

      let capturedWhere: any = null;
      let capturedSkip: number | null = null;
      let capturedTake: number | null = null;

      (prisma.movie as any).count = async ({ where }: any) => {
        capturedWhere = where;
        return 2;
      };

      (prisma.movie as any).findMany = async ({ where, skip, take }: any) => {
        capturedSkip = skip;
        capturedTake = take;
        return [
          {
            id: "m-1",
            title: "Inception",
            genres: [{ genre: { id: "g-sci-fi", name: "Sci-Fi" } }],
            languages: [{ language: { id: "l-en", name: "English" } }],
          },
          {
            id: "m-2",
            title: "Interstellar",
            genres: [{ genre: { id: "g-sci-fi", name: "Sci-Fi" } }],
            languages: [{ language: { id: "l-en", name: "English" } }],
          },
        ];
      };

      try {
        const result = await MovieService.getAllMovies({
          page: 2,
          limit: 5,
          search: "Inter",
          genreId: "g-sci-fi",
          languageId: "l-en",
        });

        assert.strictEqual(capturedSkip, 5); // (page 2 - 1) * limit 5 = 5
        assert.strictEqual(capturedTake, 5);
        assert.deepStrictEqual(capturedWhere.title, {
          contains: "Inter",
          mode: "insensitive",
        });
        assert.deepStrictEqual(capturedWhere.genres, {
          some: { id: "g-sci-fi" },
        });
        assert.deepStrictEqual(capturedWhere.languages, {
          some: { id: "l-en" },
        });

        assert.strictEqual(result.currentPage, 2);
        assert.strictEqual(result.totalPages, 1);
        assert.strictEqual(result.movies.length, 2);
      } finally {
        (prisma.movie as any).count = originalCount;
        (prisma.movie as any).findMany = originalFindMany;
      }
    });

    it("should handle empty search parameters without filtering constraints", async () => {
      const originalCount = prisma.movie.count;
      const originalFindMany = prisma.movie.findMany;

      let capturedWhere: any = null;

      (prisma.movie as any).count = async ({ where }: any) => {
        capturedWhere = where;
        return 0;
      };
      (prisma.movie as any).findMany = async () => [];

      try {
        await MovieService.getAllMovies({ page: 1, limit: 10 });
        assert.deepStrictEqual(capturedWhere, {});
      } finally {
        (prisma.movie as any).count = originalCount;
        (prisma.movie as any).findMany = originalFindMany;
      }
    });
  });
});
