import { Router } from "express";
import { addScreen, getScreenByTheater } from "./screen.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const screenRouter=Router();


screenRouter.post("/create-screen",authMiddleware,addScreen);
screenRouter.get("/screens",authMiddleware,getScreenByTheater);


export default screenRouter;