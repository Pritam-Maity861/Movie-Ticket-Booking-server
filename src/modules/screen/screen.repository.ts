import { prisma } from "../../config/prisma";
import { CreateScreenDt } from "./screen.validation";

export class ScreenRepository {
  static async createScreen(data: CreateScreenDt) {
    return prisma.screen.create({
      data: {
        name: data.name,
        theaterId: data.theaterId,
        totalSeats: data.rows.length * data.seatsPerRow,
      },
    });
  }

  static async createSeats(seats: any[]) {
    return prisma.seat.createMany({
      data: seats,
      skipDuplicates: true,
    });
  }

  static async fetchScreens(theaterId:string){
    return prisma.screen.findMany({
        where:{
            theaterId:theaterId,
        },
        include:{
            seats:true
        }
    })
  }
}
