import { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import { createTheterSchema, updateTheterSchema } from "./theaters.validation";
import { ApiError } from "../utils/api-error";
import { TheaterService } from "./theaters.service";
import { ApiResponse } from "../utils/api-response";

export const addTheatr = asyncHandler(async (req: Request, res: Response) => {
  const parsedData = createTheterSchema.safeParse(req.body);
  if (!parsedData.success) {
    throw new ApiError(400, "Validation failed", parsedData.error.issues);
  }
  const result = await TheaterService.createTheater(parsedData.data);
  res
    .status(200)
    .json(new ApiResponse(200, result, "Theater created successfully"));
});

export const getTheaters = asyncHandler(async (req: Request, res: Response) => {
  const theaters = await TheaterService.getAllTheaters();
  res
    .status(200)
    .json(new ApiResponse(200, theaters, "Theaters fetched successfully"));
});

export const getTheaterById = asyncHandler(
  async (req: Request, res: Response) => {
    const theater = await TheaterService.getTheaterById(
      req.params.id as string,
    );
    res
      .status(200)
      .json(new ApiResponse(200, theater, "Theater fetched successfully"));
  },
);

export const updateTheater = asyncHandler(
  async (req: Request, res: Response) => {
    const id=req.params.id as string;
    if(!id){
        throw new ApiError(400,"Validation failed,Id is required");
    }
    const parsedData=updateTheterSchema.safeParse(req.body);
    if(!parsedData.success){
        throw new ApiError(400,"Validation failed",parsedData.error.issues);
    }
    const result=await TheaterService.updateTheater(id,parsedData.data);
    res.status(200).json(new ApiResponse(200,result,"Theater updated successfully"));
  },
);

export const deleteTheater=asyncHandler(async(req: Request, res: Response)=>{
    const id=req.params.id as string;
    if(!id){
        throw new ApiError(400,"Validation failed,Id is required");
    }
    await TheaterService.deleteTheater(id);
    res.status(200).json(new ApiResponse(200,{},"theater deleted successfully."))
})
