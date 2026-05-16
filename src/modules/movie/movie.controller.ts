import { ApiError } from "../../utils/api-error";
import { ApiResponse } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import { MovieService } from "./movie.service";
import {
  createMovieSchema,
  genreSchema,
  languageSchema,
  updateMovieSchema,
} from "./movie.validation";
import { uploadToCloudinary } from "../../lib/cloudinery";
import fs from "fs";

/**
 * @description CURD genre
 */

export const createGenre = asyncHandler(async (req, res) => {
  const parsedData = genreSchema.safeParse(req.body);
  if (!parsedData.success) {
    throw new ApiError(400, "Validation failed", parsedData.error.issues);
  }
  const result = await MovieService.createGenre(parsedData.data);

  res
    .status(200)
    .json(new ApiResponse(200, result, "Genre created successfully"));
});

export const getGenre = asyncHandler(async (req, res) => {
  const result = await MovieService.getGenre();

  res
    .status(200)
    .json(new ApiResponse(200, result, "Genre fetched successfully"));
});

export const updateGenre = asyncHandler(async (req, res) => {
  const parsedData = genreSchema.safeParse(req.body);

  if (!parsedData.success) {
    throw new ApiError(400, "Validation failed", parsedData.error.issues);
  }
  const id = req.params.id as string;
  if (!id) {
    throw new ApiError(400, "Validation failed,Id is required");
  }
  const result = await MovieService.updateGenre(id, parsedData.data);
  res
    .status(200)
    .json(new ApiResponse(200, result, "Genre updated successfully"));
});

export const DeleteGnere = asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  if (!id) {
    throw new ApiError(400, "Validation failed,Id is required");
  }
  const result = await MovieService.deleteGenre(id);
  res
    .status(200)
    .json(new ApiResponse(200, result, "Genre deleted successfully"));
});

/**
 * CURD language
 */

export const createLanguage = asyncHandler(async (req, res) => {
  const parsedData = languageSchema.safeParse(req.body);
  if (!parsedData.success) {
    throw new ApiError(400, "Validation failed", parsedData.error.issues);
  }
  const result = await MovieService.createLanguage(parsedData.data);

  res
    .status(200)
    .json(new ApiResponse(200, result, "Language created successfully"));
});

export const getLanguage = asyncHandler(async (req, res) => {
  const result = await MovieService.getLanguage();

  res
    .status(200)
    .json(new ApiResponse(200, result, "Language fetched successfully"));
});

export const updateLanguage = asyncHandler(async (req, res) => {
  const parsedData = languageSchema.safeParse(req.body);

  if (!parsedData.success) {
    throw new ApiError(400, "Validation failed", parsedData.error.issues);
  }
  const id = req.params.id as string;
  if (!id) {
    throw new ApiError(400, "Validation failed,Id is required");
  }
  const result = await MovieService.updateLanguage(id, parsedData.data);
  res
    .status(200)
    .json(new ApiResponse(200, result, "Language updated successfully"));
});

export const DeleteLanguage = asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  if (!id) {
    throw new ApiError(400, "Validation failed,Id is required");
  }
  const result = await MovieService.deleteLanguage(id);
  res
    .status(200)
    .json(new ApiResponse(200, result, "Language deleted successfully"));
});

/**
 * CURD movie
 */

export const createMovie = asyncHandler(async (req, res) => {
  const parsedBody = {
    ...req.body,
    genreIds: JSON.parse(req.body.genreIds),
    languageIds: JSON.parse(req.body.languageIds),
    credits: JSON.parse(req.body.credits),
    duration: Number(req.body.duration),
    rating: req.body.rating ? Number(req.body.rating) : undefined,
  };
  const parsedData = createMovieSchema.safeParse(parsedBody);

  if (!parsedData.success) {
    console.log("Validation Errors:", parsedData.error.format());
    throw new ApiError(400, "Validation failed", parsedData.error.issues);
  }

  if (!req.file) {
    throw new ApiError(400, "Validation failed,Poster image is required");
  }

  let posterUrl;

  try {
    const imgUrl = await uploadToCloudinary(
      req.file.path,
      req.file.originalname,
    );
    posterUrl = imgUrl;
    console.log(posterUrl);

    // cleanup temp file

    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    if (!posterUrl) {
      throw new ApiError(500, "Cloudinary did not return a valid image url.");
    }
  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    throw new ApiError(
      500,
      error instanceof Error ? error.message : "Image upload failed",
    );
  }

  const result = await MovieService.createMovie(
    { ...parsedData.data, trailerUrl: parsedData.data.trailerUrl || "" },
    posterUrl,
  );

  res
    .status(200)
    .json(new ApiResponse(200, result, "Movie created successfully"));
});

export const getAllmovies = asyncHandler(async (req, res) => {
  let page = parseInt(req.query.page as string) || 1;
  let limit = parseInt(req.query.limit as string) || 10;
  const result = await MovieService.getAllMovies({ page, limit });
  res
    .status(200)
    .json(new ApiResponse(200, result, "Movies fetched successfully"));
});

export const getAllmoviesWithoutPagination = asyncHandler(async (req, res) => {
  const result = await MovieService.getAllMoviesWithoutPagination();
  res
    .status(200)
    .json(new ApiResponse(200, result, "Movies fetched successfully"));
});

export const getMovieById = asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  if (!id) {
    throw new ApiError(400, "Validation failed,Id is required");
  }
  const result = await MovieService.getMovieById(id);
  res
    .status(200)
    .json(new ApiResponse(200, result, "Movie fetched successfully"));
});

export const deleteMovie = asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  if (!id) {
    throw new ApiError(400, "Validation failed,Id is required");
  }
  const result = await MovieService.deleteMovie(id);
  res
    .status(200)
    .json(new ApiResponse(200, result, "Movie deleted successfully"));
});

export const updateMovie = asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  console.log("movieId:", id);
  console.log(req.body);
  if (!id) {
    throw new ApiError(400, "Validation failed, Id is required");
  }

  // Parse JSON stringified fields and numbers from FormData
  const parsedBody = { ...req.body };
  if (typeof req.body.genreIds === "string")
    parsedBody.genreIds = JSON.parse(req.body.genreIds);
  if (typeof req.body.languageIds === "string")
    parsedBody.languageIds = JSON.parse(req.body.languageIds);
  if (typeof req.body.credits === "string")
    parsedBody.credits = JSON.parse(req.body.credits);
  if (req.body.duration !== undefined)
    parsedBody.duration = Number(req.body.duration);
  if (
    req.body.rating !== undefined &&
    req.body.rating !== "null" &&
    req.body.rating !== ""
  )
    parsedBody.rating = Number(req.body.rating);

  delete parsedBody.posterUrl;

  const parsedData = updateMovieSchema.safeParse(parsedBody);
  console.log(parsedData);
  if (!parsedData.success) {
    throw new ApiError(400, "Validation failed", parsedData.error.issues);
  }
  let posterUrl: string | undefined;
  if (req.file?.path) {
    try {
      const uploaded = await uploadToCloudinary(
        req.file.path,
        req.file.originalname,
      );

      posterUrl = uploaded;

      if (!posterUrl) {
        throw new ApiError(500, "Cloudinary did not return a valid image url.");
      }

      // cleanup temp file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      // attach to update payload
      parsedData.data.posterUrl = posterUrl;
    } catch (error) {
      console.error("Cloudinary Upload Error:", error);

      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      throw new ApiError(
        500,
        error instanceof Error ? error.message : "Image upload failed",
      );
    }
  }

  const updatedMovie = await MovieService.updateMovie(id, parsedData.data);

  return res
    .status(200)
    .json(new ApiResponse(200, updatedMovie, "Movie updated successfully"));
});
