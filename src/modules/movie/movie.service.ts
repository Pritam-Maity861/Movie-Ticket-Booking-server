import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/api-error";
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
        return movie;
      },
      {
        timeout: 10000,
      } /* Set a timeout of 10 seconds for the entire transaction */,
    );
  }

  static getAllMovies({ page, limit }: { page: number; limit: number }) {
    const movies = MovieRepository.getAllMovies({ page, limit });
    if (!movies) {
      throw new Error("Failed to get movies");
    }
    return movies;
  }

  static getMovieById(id: string) {
    const movie = MovieRepository.getMovieById(id);
    if (!movie) {
      throw new Error("Failed to get movie");
    }
    return movie;
  }

  static deleteMovie(id: string) {
    const deletedMovie = MovieRepository.deleteMovie(id);
    if (!deletedMovie) {
      throw new Error("Failed to delete movie");
    }
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

      return updatedMovie;
    } catch (error) {
      console.error("Update Movie Error:", error);
      throw new Error("Failed to update movie");
    }
  }
}
