import { NextFunction, Request, Response } from "express";

import { ENV } from "../config/env";
import { ApiError } from "../utils/api-error";

/* eslint-disable @typescript-eslint/no-unused-vars */
export const errorMiddleware = (
    err: any,
    _req: Request,
    res: Response,
    _next: NextFunction
) => {
    let statusCode = 500;
    let message = "Internal Server Error";
    let errors: any[] = [];

    if (!err) {
        return res
            .status(500)
            .json({ success: false, message: "Unknown Error" });
    }

    if (err instanceof ApiError) {
        statusCode = err.statusCode;
        message = err.message;
        errors = err.errors;
    } else if (
        err.name === "PrismaClientValidationError" ||
        err.constructor?.name === "PrismaClientValidationError"
    ) {
        statusCode = 400;
        message = "Database validation error. Check your input data types.";
        errors = [err.message];
    } else if (
        err.name === "PrismaClientKnownRequestError" ||
        err.constructor?.name === "PrismaClientKnownRequestError"
    ) {
        const prismaErr = err as any;
        statusCode = 400;
        if (prismaErr.code === "P2002") {
            message = "Unique constraint failed. This record already exists.";
        } else if (prismaErr.code === "P2025") {
            message =
                "One or more related records (Subject, Session, or Faculty) not found.";
        } else if (prismaErr.code === "P2003") {
            message =
                "Foreign key constraint failed. One of the provided IDs does not exist.";
        } else {
            message = `Database error: ${prismaErr.code}`;
        }
        errors = [prismaErr.meta?.cause || prismaErr.message];
    } else {
        console.error("--- FULL ERROR START ---");
        console.error(err);
        console.error("--- FULL ERROR END ---");
        console.error("Unhandled Error Name:", err?.name);
        console.error("Unhandled Error Constructor:", err?.constructor?.name);
    }

    res.status(statusCode).json({
        success: false,
        message: message,
        errors: errors,
        stack: ENV.NODE_ENV === "development" ? err.stack : undefined,
    });
};
