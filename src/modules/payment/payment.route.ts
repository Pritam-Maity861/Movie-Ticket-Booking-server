import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { getAllPayments, getPaymentsById, PaymentController, PaymentVerifyController } from "./payment.controller";

const paymentRouter = Router();

//create order for existing booking
paymentRouter.post("/create-order",authMiddleware,PaymentController);

//payment verify
paymentRouter.post("/verify",PaymentVerifyController);


//get all payment
paymentRouter.get("/get-all-payments",authMiddleware,getAllPayments);
paymentRouter.get("/get-payments/:id",authMiddleware,getPaymentsById);



export default paymentRouter;