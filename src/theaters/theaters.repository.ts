import { prisma } from "../config/prisma";
import { ApiError } from "../utils/api-error";
import { CreateTheaterPayload, UpdateTheaterPayload } from "./theaters.validation";

export class TheaterRepository{
    static async createTheater(data:CreateTheaterPayload){
        return await prisma.theater.create({
            data: {
                ...data,
                status: "APPROVED",
            }
        })
    }

    static async getTheaters(includePending = false){
        return prisma.theater.findMany({
            where: includePending ? {} : { status: "APPROVED" }
        });
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