import { Router } from "express";
import {
  createGenre,
  createLanguage,
  createMovie,
  DeleteGnere,
  DeleteLanguage,
  deleteMovie,
  getAllmovies,
  getAllmoviesWithoutPagination,
  getGenre,
  getLanguage,
  getMovieById,
  updateGenre,
  updateLanguage,
  updateMovie,
} from "./movie.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requireRoles } from "../../middleware/role.middleware";
import upload from "../../middleware/multer.middleware";

const movieRouter = Router();

// Public discovery endpoints for movies, genres, and languages
movieRouter.get("/", getAllmovies);
movieRouter.get("/get-all-movie", getAllmovies); // with pagination
movieRouter.get("/get-all", getAllmoviesWithoutPagination); // without pagination
movieRouter.get("/genres", getGenre);
movieRouter.get("/get-genre", getGenre);
movieRouter.get("/languages", getLanguage);
movieRouter.get("/get-language", getLanguage);
movieRouter.get("/get-movie/:id", getMovieById);
movieRouter.get("/:id", getMovieById);

// Protected Genre mutation routes
movieRouter.post(
  "/add-genre",
  authMiddleware,
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  createGenre,
);
movieRouter.patch(
  "/update-genre/:id",
  authMiddleware,
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  updateGenre,
);
movieRouter.delete(
  "/delete-genre/:id",
  authMiddleware,
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  DeleteGnere,
);

// Protected Language mutation routes
movieRouter.post(
  "/add-language",
  authMiddleware,
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  createLanguage,
);
movieRouter.patch(
  "/update-language/:id",
  authMiddleware,
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  updateLanguage,
);
movieRouter.delete(
  "/delete-language/:id",
  authMiddleware,
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  DeleteLanguage,
);

// Protected Movie mutation routes
movieRouter.post(
  "/add-movie",
  authMiddleware,
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  upload.single("posterUrl"),
  createMovie,
);
movieRouter.patch(
  "/update-movie/:id",
  authMiddleware,
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  upload.single("posterUrl"),
  updateMovie,
);
movieRouter.delete(
  "/delete-movie/:id",
  authMiddleware,
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  deleteMovie,
);

export default movieRouter;
