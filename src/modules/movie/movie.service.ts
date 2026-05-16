import { prisma } from "../../config/prisma";
import { redis } from "../../config/redis";
import { ApiError } from "../../utils/api-error";
import { CACHE_KEYS, deleteByPattern, MOVIE_CACHE_TTL } from "../../utils/cache-utility";
import { MovieRepository } from "./movie.repository";

export class MovieService {
  static async createGenre(data: { name: string }) {
    const genre = MovieRepository.createGenre(data);
    if (!genre) {
      throw new ApiError(400, "Failed to create genre");
    }
    return genre;
  }

  static async getGenre() {
    const genre = MovieRepository.getGenre();
    if (!genre) {
      throw new ApiError(400, "Failed to get genre");
    }
    return genre;
  }

  static async updateGenre(id: string, data: { name: string }) {
    const genre = MovieRepository.updateGenre(id, data);
    if (!genre) {
      throw new ApiError(400, "Failed to update genre");
    }
    return genre;
  }

  static async deleteGenre(id: string) {
    const genre = MovieRepository.deleteGenre(id);
    if (!genre) {
      throw new ApiError(400, "Failed to delete genre");
    }
    return genre;
  }

  static async createLanguage(data: { name: string }) {
    const language = MovieRepository.createLanguage(data);
    if (!language) {
      throw new ApiError(400, "Failed to create language");
    }
    return language;
  }

  static async getLanguage() {
    const language = MovieRepository.getLanguage();
    if (!language) {
      throw new Error("Failed to get language");
    }
    return language;
  }

  static async updateLanguage(id: string, data: { name: string }) {
    const language = MovieRepository.updateLanguage(id, data);
    if (!language) {
      throw new Error("Failed to update language");
    }
    return language;
  }

  static async deleteLanguage(id: string) {
    const language = MovieRepository.deleteLanguage(id);
    if (!language) {
      throw new Error("Failed to delete language");
    }
    return language;
  }


  /**
   * @description clear movie cache
   */
  private static async clearMovieCache(movieId?: string){
     try {
    const tasks: Promise<any>[] = [
      redis.del(CACHE_KEYS.ALL_MOVIES),            // Clears the single "all movies" list
      deleteByPattern(CACHE_KEYS.PAGINATED_MOVIES) // Clears ALL paginated cache keys (page 1, 2, 3...)
    ];
    if (movieId) {
      tasks.push(redis.del(CACHE_KEYS.MOVIE_BY_ID(movieId))); // Clears specific movie detail
    }
    await Promise.all(tasks);
    console.log("Movie cache successfully invalidated");
  } catch (error) {
    console.error("Failed to clear movie cache:", error);
  }
  }

  /**
   * @description This method creates a new movie along with its associated genres, languages, and credits. It uses a transaction to ensure that all operations are atomic. If any operation fails, the entire transaction will be rolled back, ensuring data integrity.
   */
  static async createMovie(
    data: {
      title: string;
      description?: string;
      releaseDate: string;
      genreIds: string[];
      languageIds: string[];
      credits: {
        name: string;
        role: "ACTOR" | "DIRECTOR" | "PRODUCER";
        characterName?: string;
      }[];
      duration: number;
      trailerUrl: string;
      rating?: number;
    },
    posterUrl?: string,
  ) {
    const names = [...new Set(data.credits.map((c) => c.name))]; //get unique names from credits
    const existingPeople = await prisma.person.findMany({
      where: {
        name: { in: names },
      },
    });
    //create a map of existing people for quick lookup
    const existingMap = new Map(existingPeople.map((p) => [p.name, p]));
    const newPeople = names.filter((name) => !existingMap.has(name));
    //bulk create missing people
    if (newPeople.length > 0) {
      await prisma.person.createMany({
        data: newPeople.map((name) => ({ name })),
        skipDuplicates: true,
      });
    }
    const allPeople = await prisma.person.findMany({
      where: {
        name: { in: names },
      },
    });
    const finalMap = new Map(allPeople.map((p) => [p.name, p]));
    return await prisma.$transaction(
      async (tx) => {
        const creditData = data.credits.map((credit) => {
          const person = finalMap.get(credit.name);

          if (!person) {
            throw new Error(`Person not found: ${credit.name}`);
          }

          return {
            personId: person.id,
            role: credit.role,
            characterName: credit.characterName ?? null,
          };
        });

        //create movie
        const movie = await tx.movie.create({
          data: {
            title: data.title,
            description: data.description ?? "",
            releaseDate: new Date(data.releaseDate),
            duration: data.duration,
            trailerUrl: data.trailerUrl ?? "",
            rating: data.rating ?? 0,
            posterUrl,
            genres: {
              connect: data.genreIds.map((id) => ({ id })), //connect is used to connect existing genres to the movie
            },
            languages: {
              connect: data.languageIds.map((id) => ({ id })), //connect is used to connect existing languages to the movie
            },
            credits: {
              create: creditData,
            },
          },
          include: {
            genres: true,
            languages: true,
            credits: {
              include: {
                person: true,
              },
            },
          },
        });
        //clear cache for successful movie creation
        await this.clearMovieCache();
        return movie;
      },
      {
        timeout: 10000,
      } /* Set a timeout of 10 seconds for the entire transaction */,
    );
  }

  static async getAllMovies({ page, limit }: { page: number; limit: number }) {
    const cacheKey = `movies:page:${page}:limit:${limit}`;
     const cachedData = await redis.get(cacheKey);
    if (cachedData) return JSON.parse(cachedData);
    const movies = await MovieRepository.getAllMovies({ page, limit });
    if (!movies) {
      throw new Error("Failed to get movies");
    }
    await redis.setex(cacheKey, 3600, JSON.stringify(movies));
    return movies;
  }

  static async getAllMoviesWithoutPagination() {
    const cacheKey = CACHE_KEYS.ALL_MOVIES;
    //  await redis.del(cacheKey);
    //try to fetch from redis
    const cacheMovies = await redis.get(cacheKey);
    // console.log(cacheMovies)
    if (cacheMovies) {
      return JSON.parse(cacheMovies);
    }

    //cache miss : fetch from db
    const movies = await MovieRepository.getAllMoviesWithoutPagination();
    if (!movies) {
      throw new Error("Failed to get movies");
    }
    //store in redis
    await redis.setex(cacheKey, MOVIE_CACHE_TTL, JSON.stringify(movies));
    // console.log("movies:",movies);
    return movies;
  }

  static async getMovieById(id: string) {
    const cacheKey = CACHE_KEYS.MOVIE_BY_ID(id);
    //try to fetch from redis
    const cacheMovie = await redis.get(cacheKey);
    if (cacheMovie) {
      return JSON.parse(cacheMovie);
    }
    //cache miss : fetch from db
    const movie = await MovieRepository.getMovieById(id);
    if (!movie) {
      throw new Error("Failed to get movie");
    }
    //store in redis for next time
    await redis.setex(cacheKey, MOVIE_CACHE_TTL, JSON.stringify(movie));

    return movie;
  }

  static async deleteMovie(id: string) {
    const deletedMovie = await MovieRepository.deleteMovie(id);
    if (!deletedMovie) {
      throw new Error("Failed to delete movie");
    }
    //clear the cache for the deleted movie and the "all movies" list
    await this.clearMovieCache(id);
    return deletedMovie;
  }

  static async updateMovie(
    id: string,
    data: {
      title?: string;
      description?: string;
      releaseDate?: string;
      rating?: number;
      genreId?: string;
      languageId?: string;
      posterUrl?: string;
      trailerUrl?: string;
      duration?: number;
    },
  ) {
    try {
      const updateData: any = {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.releaseDate !== undefined && {
          releaseDate: new Date(data.releaseDate),
        }),
        ...(data.rating !== undefined && { rating: data.rating }),
        ...(data.genreId !== undefined && { genreId: data.genreId }),
        ...(data.languageId !== undefined && { languageId: data.languageId }),
        ...(data.posterUrl !== undefined && { posterUrl: data.posterUrl }),
        ...(data.trailerUrl !== undefined && { trailerUrl: data.trailerUrl }),
        ...(data.duration !== undefined && { duration: data.duration }),
      };

      const updatedMovie = await MovieRepository.updateMovie(id, updateData);

      if (updatedMovie) {
        //clear the cache for the updated movie and the "all movies" list and all the paginations from redis
        await this.clearMovieCache(id);
      } 

      return updatedMovie;
    } catch (error) {
      console.error("Update Movie Error:", error);
      throw new Error("Failed to update movie");
    }
  }
}
