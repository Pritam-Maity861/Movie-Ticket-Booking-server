import jwt from "jsonwebtoken";
import { ENV } from "../config/env";


type JwtPayload = {
    userId: string;
    role: string;
    email:string;
    exp?: number;
  };

export const generateAccessToken=(userId:string,role:string ,email:string)=>{
    const payload: JwtPayload = { userId, role , email };
    return jwt.sign(
        payload,
        ENV.JWT_ACCESS_TOKEN_SECRET as string,
        {expiresIn: ENV.ACCESS_TOKEN_EXPIRIES as jwt.SignOptions["expiresIn"]}
    );
}
export const generateRefreshToken=(userId:string)=>{
    return jwt.sign(
        {userId},
        ENV.JWT_REFRESH_TOKEN_SECRET as string,
        {expiresIn: ENV.REFRESH_TOKEN_EXPIRIES as jwt.SignOptions["expiresIn"]}
    );
}

export const verifyRefreshToken=(token:string)=>{
    try {
        const decoded = jwt.verify(token, ENV.JWT_REFRESH_TOKEN_SECRET as string) as JwtPayload;
        return decoded.userId;
    } catch (err) {
        return null;
    }
}