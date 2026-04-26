import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { PaymentController, PaymentVerifyController } from "./payment.controller";

const paymentRouter = Router();

//create order for existing booking
paymentRouter.post("/create-order",authMiddleware,PaymentController);

//payment verify
paymentRouter.post("/verify",PaymentVerifyController);



export default paymentRouter;