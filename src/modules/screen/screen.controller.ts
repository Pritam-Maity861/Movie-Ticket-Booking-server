import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { createScreenSchema } from "./screen.validation";
import { ApiError } from "../../utils/api-error";
import { ScreenServices } from "./screen.service";
import { ApiResponse } from "../../utils/api-response";
import { ScreenRepository } from "./screen.repository";

export const addScreen = asyncHandler(async (req: Request, res: Response) => {
  //addscreen logic
  const parsedData = createScreenSchema.safeParse(req.body);
  if (!parsedData.success) {
    throw new ApiError(400, "validation Error", parsedData.error.issues);
  }
  const result = await ScreenServices.createScreen(parsedData.data);
  return res
    .status(201)
    .json(new ApiResponse(201, result, "Screen added successfully"));
});

export const getScreenByTheater = asyncHandler(
  async (req: Request, res: Response) => {
    //addscreen logic
    const { theaterId } = req.query;
    if (!theaterId) {
      throw new ApiError(400, "theaterId must required.");
    }

    const screens = await ScreenServices.fetchScreens(theaterId as string);
    res
      .status(200)
      .json(new ApiResponse(200, screens, "All screens fetched successfully."));
  },
);
