import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload }  from "jsonwebtoken";
import { ENV } from "../config/env";

interface AuthRequest extends Request {
    user?: string | JwtPayload
  }
  

export const authMiddleware=(req:AuthRequest,res:Response,next:NextFunction)=>{
    try {
        const authHeader=req.headers.authorization;
        if(!authHeader || !authHeader.startsWith("Bearer ")){
            return res.status(401).json({message:"Unauthorized:No token provided"});
        }
        const token=authHeader.split(" ")[1];
        const decoded=jwt.verify(token, ENV.JWT_ACCESS_TOKEN_SECRET as string);
        req.user =decoded;
        next();
    } catch (error) {
        return res.status(401).json({message:"Unauthorized:Invalid token"});
    }
}