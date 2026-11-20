import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { createShowtimeSchema } from "./showtime.validation";
import { ApiError } from "../../utils/api-error";
import { ShowtimeService } from "./showtime.service";
import { ApiResponse } from "../../utils/api-response";

/**
 * @description  create showtime
 */
export const createShowtime = asyncHandler(
  async (req: Request, res: Response) => {
    const parsedData = createShowtimeSchema.safeParse(req.body);
    if (!parsedData.success) {
      throw new ApiError(
        400,
        "input validation failed.",
        parsedData.error.issues,
      );
    }
    const result = await ShowtimeService.createShowtime(parsedData.data);

    res
      .status(201)
      .json(new ApiResponse(200, result, "showtime created successfully"));
  },
);

/**
 * @description  get all showtime
 */
export const getShowtimes = asyncHandler(
  async (req: Request, res: Response) => {
    const movieId = (req.query.movieId as string) || req.body?.movieId;
    const dateStr = (req.query.date as string) || req.body?.date;
    const theaterId = (req.query.theaterId as string) || req.body?.theaterId;

    if (!movieId || !dateStr) {
      throw new ApiError(400, "movieId and date are required query parameters");
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new ApiError(400, "Invalid date format. Expected YYYY-MM-DD");
    }

    const result = await ShowtimeService.getShowtimes(
      movieId,
      date,
      theaterId,
    );
    res
      .status(200)
      .json(new ApiResponse(200, result, "showtimes fetched successfully"));
  },
);

/**
 * @description  get showtime by id
 */
export const getShowtimeById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await ShowtimeService.getShowtimeById(id as string);
    res
      .status(200)
      .json(new ApiResponse(200, result, "showtime fetched successfully"));
  },
);

/**
 * @description  get showtime seat availability map
 */
export const getShowtimeSeats = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
      throw new ApiError(400, "Showtime ID is required");
    }
    const result = await ShowtimeService.getShowtimeSeatAvailability(id as string);
    res
      .status(200)
      .json(new ApiResponse(200, result, "Showtime seats fetched successfully"));
  },
);

/**
 * @description  get showtimes by screen id
 */
export const getShowtimesByScreenId = asyncHandler(
  async (req: Request, res: Response) => {
    const { screenId } = req.params;
    if (!screenId) {
      throw new ApiError(400, "screen id is required");
    }
    const result = await ShowtimeService.getShowtimesByScreenId(
      screenId as string,
    );
    res
      .status(200)
      .json(new ApiResponse(200, result, "showtimes fetched successfully"));
  },
);

/**
 * @description  delete showtime
 */
export const deleteShowtime = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.query;
    if (!id) {
      throw new ApiError(400, "showtime id is required");
    }
    await ShowtimeService.deleteShowtime(id as string);
    res
      .status(200)
      .json(new ApiResponse(200, null, "showtime deleted successfully"));
  },
);
