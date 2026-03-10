import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { ENV } from "./env";
import { PrismaClient } from "../generated/prisma/client";

/**
 * Create a PostgreSQL connection pool
 */
const pool = new Pool({
  connectionString: ENV.DATABASE_URL,
});

/**
 * Create a driver adapter instance using PrismaPg with the pool
 */
const adapter = new PrismaPg(pool);

/**
 * Instantiate PrismaClient with the adapter
 */
export const prisma = new PrismaClient({ adapter });
