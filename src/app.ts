import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import AllRouter from "./routes";
import { errorMiddleware } from "./middleware/error.middleware";
import cookieParser from "cookie-parser";
import { ENV } from "./config/env";
dotenv.config();

const app = express();

app.set("trust proxy", 1);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({ origin: ENV.CLIENT_URL, credentials: true }));

// Routes
app.get("/", (req, res) => {
  res.send("this is / route!");
});

app.use("/api/v1", AllRouter);

//error handling middleware
app.use(errorMiddleware);

export default app;
