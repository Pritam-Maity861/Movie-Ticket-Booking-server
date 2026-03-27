import {object, z} from 'zod';
import { duration } from 'zod/v4/classic/iso.cjs';

export const genreSchema=z.object({
    name:z.string().min(2,'Gnere must be at least 2 characters long'),
})
export const languageSchema=z.object({
    name:z.string().min(2,'Language must be at least 2 characters long'),
})

export const createMovieSchema=z.object({
    title:z.string().min(1,'Title must be at least 1 characters long'),
    description:z.string().min(10,'Description must be at least 10 characters long').optional(),
    releaseDate:z.string().refine((date) => !isNaN(Date.parse(date)), {
        message: "Invalid date format. Expected a valid date string.",
      }),
      genreIds: z
      .array(z.string().uuid("Invalid genre ID"))
      .min(1, "At least one genre is required"),
      languageIds: z
      .array(z.string().uuid("Invalid language ID"))
      .min(1, "At least one language is required"),
    rating:z.coerce.number().min(1,"atleast ratting 1").max(10,"at most ratting is 10").optional(),
    duration:z.coerce.number("must be a number"), 
    trailerUrl:z.string().url('Trailer URL must be a valid URL').optional(),
    credits: z
    .array(
      z.object({
        name: z.string().min(1, "Person name is required"),

        role: z.enum(["ACTOR", "DIRECTOR", "PRODUCER"]),

        characterName: z.string().optional()
      })
    )
    .min(1, "At least one credit is required")
    // posterUrl:z.string().url('Poster URL must be a valid URL').optional(),
})

export const updateMovieSchema = z.object({
    title: z.string().min(1, "Title cannot be empty"),
    description: z.string().optional(),
    duration: z.coerce.number("must be a number"), 
    languageIds: z
      .array(z.string().uuid("Invalid language ID"))
      .optional(),
    genreIds: z
    .array(z.string().uuid("Invalid genre ID"))
    .optional(),
    trailerUrl: z.string().url("Invalid trailer URL").optional(),
    releaseDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
        message: "Invalid date format. Expected a valid date string.",
      }),
    posterUrl: z.string().url("Invalid poster URL").optional(),
    rating:z.coerce.number().min(1,"atleast ratting 1").max(10,"at most ratting is 10").optional(),
    credits: z
      .array(
        z.object({
          name: z.string().min(1),
          role: z.enum(["ACTOR", "DIRECTOR", "PRODUCER"]),
          characterName: z.string().optional()
        })
      )
      .optional()
  }).partial().refine((data) =>Object.keys(data).length > 0, {message: "At least one field must be provided for update",}
  );