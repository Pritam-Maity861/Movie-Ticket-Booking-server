import { Router } from "express";
import { createGenre, createLanguage, createMovie, DeleteGnere, DeleteLanguage, deleteMovie, getAllmovies, getGenre, getLanguage, getMovieById, updateGenre, updateLanguage, updateMovie } from "./movie.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import upload from "../../middleware/multer.middleware";

const movieRouter= Router();

//genre routes
movieRouter.post("/add-genre",authMiddleware,createGenre);
movieRouter.get("/get-genre",authMiddleware,getGenre);
movieRouter.patch("/update-genre/:id",authMiddleware,updateGenre);
movieRouter.delete("/delete-genre/:id",authMiddleware,DeleteGnere);


//language routes
movieRouter.post("/add-language",authMiddleware,createLanguage);
movieRouter.get("/get-language",authMiddleware,getLanguage);
movieRouter.patch("/update-language/:id",authMiddleware,updateLanguage);
movieRouter.delete("/delete-language/:id",authMiddleware,DeleteLanguage);

//movie routes
movieRouter.post("/add-movie",upload.single("posterUrl"),createMovie);
movieRouter.get("/get-all-movie",getAllmovies);
movieRouter.patch("/update-movie/:id",upload.single("posterUrl"),updateMovie);
movieRouter.delete("/delete-movie/:id",authMiddleware,deleteMovie);
movieRouter.get("/get-movie/:id",getMovieById);





export default movieRouter;