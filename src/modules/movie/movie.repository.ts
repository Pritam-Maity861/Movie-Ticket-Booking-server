import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/api-error";

export class MovieRepository{
    static createGenre(data:{name:string}){
            return prisma.genre.create({
                data:{
                    name:data.name
                }
            })
    }

    static getGenre(){
        return prisma.genre.findMany();
    }

    static updateGenre(id:string,data:{name:string}){
        return prisma.genre.update({
            where:{
                id
            },
            data:{
                name:data.name
            }
        })
    }

    static deleteGenre(id:string){
        return prisma.genre.delete({
            where:{
                id
            }
        })
    }

    static createLanguage(data:{name:string}){
        return prisma.language.create({
            data:{
                name:data.name
            }
        })
    }

    static getLanguage(){
        return prisma.language.findMany();
    }

    static updateLanguage(id:string,data:{name:string}){
        return prisma.language.update({
            where:{
                id
            },
            data:{
                name:data.name
            }
        })
    }

    static deleteLanguage(id:string){
        return prisma.language.delete({
            where:{
                id
            }
        })
    }

    // static createMovie(data: {
    //     title: string;
    //     description?: string;
    //     releaseDate: Date;
    //     rating?: number;
    //     genreId: string;
    //     languageId: string;
    //     posterUrl?: string;
    //     trailerUrl: string;
    //     duration: number;
    //   }) {
    //     return prisma.movie.create({
    //       data: {
    //         title: data.title,
    //         description: data.description,
    //         releaseDate: data.releaseDate,
    //         rating: data.rating,
    //         genreId: data.genreId,
    //         languageId: data.languageId,
    //         duration: data.duration,
    //         trailerUrl: data.trailerUrl,
    //         posterUrl: data.posterUrl,
    //       },
    //     });
    //   }

      static async getAllMovies({
        page,
        limit,
        search,
        genreId,
        languageId,
      }: {
        page: number;
        limit: number;
        search?: string;
        genreId?: string;
        languageId?: string;
      }) {
        const skip = (page - 1) * limit; // calculate the number of records to skip

        const whereClause: any = {};

        if (search && search.trim() !== "") {
          whereClause.title = {
            contains: search.trim(),
            mode: "insensitive",
          };
        }

        if (genreId) {
          whereClause.genres = {
            some: { id: genreId },
          };
        }

        if (languageId) {
          whereClause.languages = {
            some: { id: languageId },
          };
        }

        const [movies, total] = await Promise.all([
          prisma.movie.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy: {
              createdAt: "desc",
            },
            include: {
              languages: true,
              genres: true,
              credits: {
                include: {
                  person: true,
                },
              },
            },
          }),
          prisma.movie.count({ where: whereClause }),
        ]);

        return {
          movies,
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalCount: total,
          hasMore: skip + movies.length < total,
        };
      }

      static getAllMoviesWithoutPagination(){
        return prisma.movie.findMany({
            orderBy:{
                createdAt:'desc'
            },
            include:{
                languages:true,
                genres:true,
                credits:{
                    include:{
                        person:true
                    }
                }
            }
        });
      }

      static getMovieById(id:string){
        return prisma.movie.findUnique({
            where:{
                id
            },
            include:{
                languages:true,
                genres:true,
                credits:{
                    include:{
                        person:true
                    }
                }
            }
        })
      }

      static deleteMovie(id:string){
        return prisma.movie.delete({
            where:{
                id
            }
        })
      }

      static async updateMovie(
        id: string,
        data: {
          title?: string;
          description?: string;
          releaseDate?: Date;
          rating?: number;
          genreId?: string;
          languageId?: string;
          posterUrl?: string;
          trailerUrl?: string;
          duration?: number;
        }
      ) {
        const existingMovie=await prisma.movie.findUnique({
            where:{
                id
            }
        });
        if(!existingMovie){
            throw new ApiError(404,'Movie not found');
        }
        const updateData: any = {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.releaseDate !== undefined && { releaseDate: data.releaseDate }),
          ...(data.rating !== undefined && { rating: data.rating }),
          ...(data.genreId !== undefined && { genreId: data.genreId }),
          ...(data.languageId !== undefined && { languageId: data.languageId }),
          ...(data.duration !== undefined && { duration: data.duration }),
          ...(data.trailerUrl !== undefined && { trailerUrl: data.trailerUrl }),
          ...(data.posterUrl !== undefined && { posterUrl: data.posterUrl }),
        };
      
        return prisma.movie.update({
          where: { id },
          data: updateData,
        });
      }
}