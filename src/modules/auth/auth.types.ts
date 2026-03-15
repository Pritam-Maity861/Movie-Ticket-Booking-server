import { Request } from "express";


export interface registerUser {
    email: string;
    password: string;
    name: string;
    ipaddress?: string;
    device?: string;
    userAgent?: string;
}

export interface loginUser {
    email: string;
    password: string;
    ipaddress?: string;
    device?: string;
    userAgent?: string;
}


export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  exp?: number;
}

export interface AuthRequest extends Request {
  user?: JWTPayload;
}