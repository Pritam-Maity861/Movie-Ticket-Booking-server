import {z} from "zod";

export const createScreenSchema=z.object({
    name:z.string().min(1,"Screen name is required"),
    theaterId:z.string().min(1,"Theater id is required"),
    rows:z.array(z.string().min(1, "Row cannot be empty")),
    seatsPerRow:z.number().min(5,"seats per row seats is required"),
})

export type CreateScreenDt=z.infer<typeof createScreenSchema>;