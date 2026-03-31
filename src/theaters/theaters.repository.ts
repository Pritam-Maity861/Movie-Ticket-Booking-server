import { prisma } from "../config/prisma";
import { ApiError } from "../utils/api-error";
import { CreateTheaterPayload, UpdateTheaterPayload } from "./theaters.validation";

export class TheaterRepository{
    static async createTheater(data:CreateTheaterPayload){
        return await prisma.theater.create({
            data
        })
    }

    static async getTheaters(){
        return prisma.theater.findMany();
    }

    static async getTheaterById(id:string){
        return prisma.theater.findUnique({
            where:{id}
        })
    }

    static async deleteTheater(id:string){
        return prisma.theater.delete({
            where:{id}
        })
    }

    static async updateTheater(id:string,data:UpdateTheaterPayload){
        try {
            return prisma.theater.update({
            where:{id},
            data:data
        })
        } catch (error) {
            throw new ApiError(404, "Theater not found");
        }
    }
}