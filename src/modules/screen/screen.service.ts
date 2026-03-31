import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/api-error";
import { ScreenRepository } from "./screen.repository";
import { CreateScreenDt } from "./screen.validation";

export class ScreenServices {
  static async createScreen(data: CreateScreenDt) {
    const screen = await ScreenRepository.createScreen(data);

    //  Helper: get seat type by row
    const getSeatType = (row: string) => {
  const char = row.toUpperCase().charCodeAt(0);

  if (char >= 65 && char <= 66) return "PREMIUM"; // A-B
  if (char >= 67 && char <= 69) return "VIP";     // C-E
  return "REGULAR";                               // F+
};

    const seats = [];

    for (const row of data.rows) {
      for (let i = 1; i <= data.seatsPerRow; i++) {
        seats.push({
          screenId: screen.id,
          row,
          number: i,
          type: getSeatType(row),
        });
      }
    }

    await ScreenRepository.createSeats(seats);

    return screen;
  }


  static async fetchScreens(theaterId:string){
    const screens= ScreenRepository.fetchScreens(theaterId);
    if(!screens){
            throw new ApiError(400,"no screen found");
        }
    return screens;
  }
}
