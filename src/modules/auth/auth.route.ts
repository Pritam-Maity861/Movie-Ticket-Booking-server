import { Router } from "express";
import { getMe, logOut, logOutAllDevices, refreshToken, signIn, signUp } from "./auth.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const authRouter=Router();

authRouter.post("/signup",signUp);
authRouter.post("/signin",signIn);
authRouter.post("/refresh", refreshToken);
authRouter.post("/logout", logOut);
authRouter.post("/logout-all-devices",authMiddleware, logOutAllDevices);
authRouter.get("/me",authMiddleware,getMe);

export default authRouter;