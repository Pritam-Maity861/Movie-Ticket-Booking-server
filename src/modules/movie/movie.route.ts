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

// Genre routes
movieRouter.post(
  "/add-genre",
  authMiddleware,
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  createGenre,
);
movieRouter.get("/get-genre", authMiddleware, getGenre);
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

// Language routes
movieRouter.post(
  "/add-language",
  authMiddleware,
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  createLanguage,
);
movieRouter.get("/get-language", authMiddleware, getLanguage);
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

// Movie routes
movieRouter.post(
  "/add-movie",
  authMiddleware,
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  upload.single("posterUrl"),
  createMovie,
);
movieRouter.get("/get-all-movie", getAllmovies); // with pagination
movieRouter.get("/get-all", getAllmoviesWithoutPagination); // without pagination
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
movieRouter.get("/get-movie/:id", getMovieById);

export default movieRouter;
