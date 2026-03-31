import z from "zod";

export const createTheterSchema=z.object({
    name:z.string().min(2,"Name must be at least 2 characters long"),
    city:z.string().min(2,"City must be at least 2 characters long"),
    address:z.string().min(2,"Address must be at least 2 characters long"),
    ratting:z.number().min(0).max(10).optional(),
})

export const updateTheterSchema=z.object({
    name:z.string().min(2,"Name must be at least 2 characters long").optional(),
    city:z.string().min(2,"City must be at least 2 characters long").optional(),
    address:z.string().min(2,"Address must be at least 2 characters long").optional(),
    ratting:z.number().min(0).max(10).optional(),   
}).partial().refine((data) =>Object.keys(data).length > 0, {message: "At least one field must be provided for update",})



export type CreateTheaterPayload = z.infer<typeof createTheterSchema>;
export type UpdateTheaterPayload = z.infer<typeof updateTheterSchema>;