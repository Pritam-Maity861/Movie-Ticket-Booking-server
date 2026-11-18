export interface AuthUser {
  userId: string;
  role: "USER" | "ADMIN" | "SUPER_ADMIN" | "THEATER_OWNER" | string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
      user?: AuthUser;
    }
  }
}
