import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/api-error";

export const requireRoles = (allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return next(new ApiError(401, "Unauthorized: Authentication required"));
    }
    if (!allowedRoles.includes(user.role)) {
      return next(
        new ApiError(
          403,
          "Forbidden: You do not have permission to access this resource",
        ),
      );
    }
    next();
  };
};

export const requireRole = requireRoles;
