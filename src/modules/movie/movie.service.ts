import { MovieRepository } from "./movie.repository";

export class MovieService{
    static async createGenre(data:{name:string}){
        const genre=MovieRepository.createGenre(data);
        if(!genre){
            throw new Error("Failed to create genre");
        }
        return genre;
    }

        static async getGenre(){
            const genre=MovieRepository.getGenre();
            if(!genre){
                throw new Error("Failed to get genre");
            }
            return genre;
        }

        static async updateGenre(id:string,data:{name:string}){
            const genre=MovieRepository.updateGenre(id,data);
            if(!genre){
                throw new Error("Failed to update genre");
            }
            return genre;
        }

        static async deleteGenre(id:string){
            const genre=MovieRepository.deleteGenre(id);
            if(!genre){
                throw new Error("Failed to delete genre");
            }
            return genre;
        }



        static async createLanguage(data:{name:string}){
            const language=MovieRepository.createLanguage(data);
            if(!language){
                throw new Error("Failed to create language");
            }
            return language;
        }

        static async getLanguage(){
            const language=MovieRepository.getLanguage();
            if(!language){
                throw new Error("Failed to get language");
            }
            return language;
        }

        static async updateLanguage(id:string,data:{name:string}){
            const language=MovieRepository.updateLanguage(id,data);
            if(!language){
                throw new Error("Failed to update language");
            }
            return language;
        }

        static async deleteLanguage(id:string){
            const language=MovieRepository.deleteLanguage(id);
            if(!language){
                throw new Error("Failed to delete language");
            }
            return language;
        }


        static async createMovie(
            data: {
              title: string;
              description?: string;
              releaseDate: string;
              genreId: string;
              languageId: string;
              duration: number;
              trailerUrl: string; 
              rating?: number;
            },
            posterUrl?: string
          ) {
            const movie = await MovieRepository.createMovie({
              title: data.title,
              description: data.description ?? "",
              releaseDate: new Date(data.releaseDate),
              rating: data.rating ?? 0,
              genreId: data.genreId,
              languageId: data.languageId,
              posterUrl: posterUrl ?? "",
              trailerUrl: data.trailerUrl,
              duration: data.duration,
            });
          
            if (!movie) {
              throw new Error("Failed to create movie");
            }
          
            return movie;
          }

          static getAllMovies(){
            const movies=MovieRepository.getAllMovies();
            if(!movies){
                throw new Error("Failed to get movies");
            }
            return movies;
          }

          static getMovieById(id:string){
            const movie=MovieRepository.getMovieById(id);
            if(!movie){
                throw new Error("Failed to get movie");
            }
            return movie;
          }

          static deleteMovie(id:string){
            const deletedMovie=MovieRepository.deleteMovie(id);
            if(!deletedMovie){
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
            }
          ) {
            try {
              const updateData: any = {
                ...(data.title !== undefined && { title: data.title }),
                ...(data.description !== undefined && { description: data.description }),
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