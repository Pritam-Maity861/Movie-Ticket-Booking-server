import { ApiError } from "../utils/api-error";
import { TheaterRepository } from "./theaters.repository";
import { CreateTheaterPayload, UpdateTheaterPayload } from "./theaters.validation";

export class TheaterService {
  static async createTheater(data: CreateTheaterPayload) {
    const theater = await TheaterRepository.createTheater(data);
    if (!theater) {
      throw new ApiError(400, "Failed to create theater");
    }
    return theater;
  }

  static async getAllTheaters() {
    const theaters = await TheaterRepository.getTheaters();
    if (!theaters) {
      throw new ApiError(400, "Failed to get theaters");
    }
    return theaters;
  }

  static async getTheaterById(id: string) {
    if (!id) {
      throw new ApiError(400, "Id must be required.");
    }
    const theater = await TheaterRepository.getTheaterById(id);
    if (!theater) {
      throw new ApiError(400, "Failed to get theater");
    }
    return theater;
  }

  static async deleteTheater(id: string) {
    if (!id) {
      throw new ApiError(400, "Id must be required.");
    }
    const theater = await TheaterRepository.deleteTheater(id);
    if (!theater) {
      throw new ApiError(400, "Failed to delete theater");
    }
    return theater;
  }

  static async updateTheater(id:string,data:UpdateTheaterPayload){
    if(!id){
        throw new ApiError(400,"Id must be required.");
    }
    const theater=await TheaterRepository.updateTheater(id,data);
    if(!theater){
        throw new ApiError(400,"Failed to update theater");
    }
    return theater;
  }
}
