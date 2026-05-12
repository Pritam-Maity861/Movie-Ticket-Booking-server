import { Request, Response } from "express";
import { loginSchema, registerSchema } from "./auth.validation";
import { ApiError } from "../../utils/api-error";
import { asyncHandler } from "../../utils/async-handler";
import { AuthService } from "./auth.service";
import { ApiResponse } from "../../utils/api-response";
import { AuthRequest } from "./auth.types";
import { uploadToCloudinary } from "../../lib/cloudinery";
import fs from "fs";

/**
 * @description Sign up a new user
 * @param req
 * @param res
 */
export const signUp = asyncHandler(async (req: Request, res: Response) => {
  const parsedData = registerSchema.safeParse(req.body);
  if (!parsedData.success) {
    throw new ApiError(400, "Validation failed", parsedData.error.issues);
  }
  const device = req.headers["user-agent"] || "Unknown";
  const result = await AuthService.registerUser({
    email: parsedData.data.email,
    password: parsedData.data.password,
    name: parsedData.data.name,
    device,
    ipaddress: req.ip,
    userAgent: device,
  });

  //set httponly cookie for refresh token
  res.cookie("refreshToken", result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // Set secure flag in production
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { user: result.user, accessToken: result.accessToken },
        "User registered successfully",
      ),
    );
});

/**
 *  * @description Sign in an existing user
 * @param req
 * @param res
 */
export const signIn = asyncHandler(async (req: Request, res: Response) => {
  const parsedData = loginSchema.safeParse(req.body);
  if (!parsedData.success) {
    throw new ApiError(400, "Validation failed", parsedData.error.issues);
  }
  const device = req.headers["user-agent"] || "Unknown";
  const result = await AuthService.loginUser({
    email: parsedData.data.email,
    password: parsedData.data.password,
    ipaddress: req.ip,
    device,
    userAgent: device,
  });

  //set refreshToken in httpOnly cookie
  res.cookie("refreshToken", result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // Set secure flag in production
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { user: result.user, accessToken: result.accessToken },
        "User logged in successfully",
      ),
    );
});

/**
 * @description Refresh access token using refresh token
 * @param req
 * @param res
 */
export const refreshToken = asyncHandler(
  async (req: Request, res: Response) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      throw new ApiError(401, "Refresh token not found");
    }
    const result = await AuthService.refreshToken(refreshToken);
    if (!result || !result.accessToken || !result.refreshToken) {
      throw new ApiError(401, "Invalid refresh token response");
    }

    //set new refresh token in httpOnly cookie
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { user: result.user, accessToken: result.accessToken },
          "Access token refreshed successfully",
        ),
      );
  },
);

/**
 * @description Logout user by invalidating refresh token
 */
export const logOut = asyncHandler(async (req: AuthRequest, res: Response) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    throw new ApiError(400, "Refresh token not found");
  }
  await AuthService.logOut(refreshToken);
  //clear refresh token cookie
  // res.cookie("refreshToken","",{
  //   httpOnly:true,
  //   secure:process.env.NODE_ENV==="production",
  //   sameSite:"none",
  //   expires:new Date(0), // Set the cookie to expire immediately
  // })

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });

  res
    .status(200)
    .json(new ApiResponse(200, null, "User logged out successfully"));
});

/**
 * @description logOut from all devices..
 */
export const logOutAllDevices = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    if (!req.user?.userId) {
      throw new ApiError(401, "Unauthorized");
    }
    await AuthService.logOutAllDevices(req.user.userId);
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          null,
          "User logged out from all devices successfully",
        ),
      );
  },
);

/**
 * @description get me endpoint to get current logged in user details
 * @param req
 * @param res
 */

export const getMe = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user?.userId) {
    throw new ApiError(401, "Unauthorized");
  }

  const user = await AuthService.getCurrentUser(req.user.userId);

  res.status(200).json(new ApiResponse(200, user));
});

/**
 * @description update user profile details
 * @param req
 * @param res
 */
export const updateProfile = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    if (!req.user?.userId) {
      throw new ApiError(401, "Unauthorized");
    }

    const { name } = req.body;
    let profilePicUrl = undefined;

    if (req.file) {
      try {
        profilePicUrl = await uploadToCloudinary(
          req.file.path,
          req.file.originalname,
        );

        // cleanup temp file after uploadToCloudinary (redundant as uploadToCloudinary does it, but safe)
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        throw new ApiError(500, "Profile picture upload failed");
      }
    }

    const updatedUser = await AuthService.updateProfile(req.user.userId, {
      name,
      profilePicUrl,
    });

    res
      .status(200)
      .json(new ApiResponse(200, updatedUser, "Profile updated successfully"));
  },
);
