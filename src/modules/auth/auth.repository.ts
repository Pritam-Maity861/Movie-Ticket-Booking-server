import { prisma } from "../../config/prisma";
import crypto from "crypto";

export class AuthRepository {
  static findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: {
        email,
      },
    });
  }

  static createUser(email: string, password: string, name: string) {
    return prisma.user.create({
      data: {
        email,
        password,
        name,
      },
    });
  }
  static updateUserRefreshToken(
    userId: string,
    hashedRefreshToken: string,
    ipAddress?: string,
    userAgent?: string,
    device?: string,
  ) {
    return prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashedRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Set expiry to 7 days
        ipAddress,
        userAgent,
        device,
      },
    });
  }

  static findValidRefreshToken(refreshToken: string) {
    const tokenHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    return prisma.refreshToken.findFirst({
      where: {
        tokenHash: tokenHash,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: {
            id: true,
            role: true,
            name: true,
            email: true,
            profilePicUrl: true,
          },
        },
      },
    });
  }

  static revokeRefreshToken(tokenId: string) {
    return prisma.refreshToken.update({
      where: {
        id: tokenId,
      },
      data: {
        revoked: true,
      },
    });
  }

  static findUserById(userId: string) {
    return prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        profilePicUrl: true,
      },
    });
  }
}
