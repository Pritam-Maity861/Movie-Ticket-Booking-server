import dotenv from 'dotenv';
dotenv.config();

export const ENV={
    PORT: process.env.PORT || 3000,
    DATABASE_URL: process.env.DATABASE_URL || '',
    JWT_ACCESS_TOKEN_SECRET:process.env.JWT_ACCESS_TOKEN_SECRET || 'default access token secret',
    JWT_REFRESH_TOKEN_SECRET:process.env.JWT_REFRESH_TOKEN_SECRET || 'default refresh token secret',
    ACCESS_TOKEN_EXPIRIES:process.env.ACCESS_TOKEN_EXPIRIES || '15m',
    REFRESH_TOKEN_EXPIRIES:process.env.REFRESH_TOKEN_EXPIRIES || '7d',
    NODE_ENV:process.env.NODE_ENV || 'development',
    CLIENT_URL:process.env.CLIENT_URL || 'http://localhost:5173',
    UPSTASH_REDIS_URL:process.env.UPSTASH_REDIS_URL || '',
    UPSTASH_REDIS_TOKEN:process.env.UPSTASH_REDIS_TOKEN || '',
    
}