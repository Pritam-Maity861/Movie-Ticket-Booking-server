import { compareHash, hashData } from "../../utils/hash";
import { loginUser, registerUser } from "./auth.types";
import { AuthRepository } from "./auth.repository";
import { generateAccessToken, generateRefreshToken } from "../../utils/jwt";
import crypto from "crypto";

export class AuthService {
  static async registerUser(regUser: registerUser) {
    const existingUser = await AuthRepository.findUserByEmail(regUser.email);
    if (existingUser) {
      throw new Error("User already exists with this email");
    }
    const hashedPassword = await hashData(regUser.password);

    const user = await AuthRepository.createUser(
      regUser.email,
      hashedPassword,
      regUser.name,
    );

    const accessToken = generateAccessToken(user.id, user.role, user.email);
    const refreshToken = generateRefreshToken(user.id);

    //hash the refresh token before storing it in the database for security
    const hashedRefreshToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");
    await AuthRepository.updateUserRefreshToken(
      user.id,
      hashedRefreshToken,
      regUser.ipaddress,
      regUser.userAgent,
      regUser.device,
    );

    return {
      accessToken: accessToken,
      refreshToken: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        profilePic: user.profilePicUrl,
      },
    };
  }

  static async loginUser(loginUser: loginUser) {
    const existingUser = await AuthRepository.findUserByEmail(loginUser.email);
    if (!existingUser) {
      throw new Error("Invalid credentials");
    }
    const isPasswordValid = await compareHash(
      loginUser.password,
      existingUser.password,
    );
    if (!isPasswordValid) {
      throw new Error("Invalid credentials");
    }
    const AccessToken = generateAccessToken(
      existingUser.id,
      existingUser.role,
      existingUser.email,
    );
    const RefreshToken = generateRefreshToken(existingUser.id);

    //hash the refresh token before storing it in the database for security
    const hashedRefreshToken = crypto
      .createHash("sha256")
      .update(RefreshToken)
      .digest("hex");
    await AuthRepository.updateUserRefreshToken(
      existingUser.id,
      hashedRefreshToken,
      loginUser.ipaddress,
      loginUser.userAgent,
      loginUser.device,
    );

    //store refreshToken in httpOnly cookie
    return {
      accessToken: AccessToken,
      refreshToken: RefreshToken,
      user: {
        id: existingUser.id,
        email: existingUser.email,
        name: existingUser.name,
        role: existingUser.role,
        profilePic: existingUser.profilePicUrl,
      },
    };
  }

  //refresh token rotation service logic..
  static async refreshToken(refreshToken: string) {
    const validToken = await AuthRepository.findValidRefreshToken(refreshToken);

    if (!validToken) {
      throw new Error("Invalid or expired refresh token");
    }

    const AccessToken = generateAccessToken(
      validToken.userId,
      validToken.user.role,
      validToken.user.email,
    );
    const newRefreshToken = generateRefreshToken(validToken.userId);

    //revoke the old refresh token by marking it as revoked in the database
    await AuthRepository.revokeRefreshToken(validToken.id);

    //hash the new refresh token before storing it in the database for security
    const hashedRefreshToken = crypto
      .createHash("sha256")
      .update(newRefreshToken)
      .digest("hex");
    await AuthRepository.updateUserRefreshToken(
      validToken.userId,
      hashedRefreshToken,
      validToken.ipAddress ?? undefined,
      validToken.userAgent ?? undefined,
      validToken.device ?? undefined,
    );

    return {
      accessToken: AccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: validToken.user.id,
        email: validToken.user.email,
        name: validToken.user.name,
        role: validToken.user.role,
        profilePic: validToken.user.profilePicUrl,
      },
    };
  }

  static async logOut(refreshToken: string) {
    const validToken = await AuthRepository.findValidRefreshToken(refreshToken);
    if (!validToken) {
      throw new Error("Invalid refresh token");
    }
    await AuthRepository.revokeRefreshToken(validToken.id);
  }

  static async getCurrentUser(userId: string) {
    const user = await AuthRepository.findUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      profilePic: user.profilePicUrl,
    };
  }

  static async logOutAllDevices(userId: string) {
    await AuthRepository.revokeAllRefreshTokensForUser(userId);
  }

  static async updateProfile(
    userId: string,
    data: { name?: string; profilePicUrl?: string },
  ) {
    const user = await AuthRepository.updateUser(userId, data);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      profilePic: user.profilePicUrl,
    };
  }
}
