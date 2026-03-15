import { prisma } from "../../config/prisma";
import crypto from "crypto";
import cron from "node-cron";

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

  /**
   * @description This method is scheduled to run every day at 3 AM and it will delete all the refresh tokens that are revoked and expired for more than 7 days to keep the database clean and avoid storing unnecessary data.
   */
  static cleanUpRefreshTokens() {
    cron.schedule("0 3 * * *", async () => {  // Schedule to run every day at 3 AM
      await prisma.refreshToken.deleteMany({
        where: {
          OR: [
            {
              revoked: true,
              createdAt: {
                lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),   // Only delete revoked tokens that are older than 7 days to avoid deleting recently revoked tokens that might still be needed for security audits or investigations.
              },
            },
            {
              expiresAt: {
                lt: new Date(),    // Delete all expired tokens 
              },
            },
          ],
        },
      })
    });
  }

  static revokeAllRefreshTokensForUser(userId: string) {
    return prisma.refreshToken.updateMany({
      where: {
        userId,
        revoked: false,
      },
      data: {
        revoked: true,
      },
    });
  }
}
