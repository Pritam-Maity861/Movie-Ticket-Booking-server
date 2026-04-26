import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { PaymentService } from "./payment.service";
import { ApiResponse } from "../../utils/api-response";

export const PaymentController = asyncHandler(async (req:Request,res:Response)=>{
    const {bookingId} = req.body;
    const userId = (req as any).user?.userId;
    if(!userId){
        return res.status(401).json({message:"User not authenticated"});
    }
    const result = await PaymentService.createRazorpayOrder(bookingId,userId);

    res.status(200).json(new ApiResponse(200,result,"Order created successfully"));
})

export const PaymentVerifyController = asyncHandler(async (req:Request,res:Response)=>{
    const result = await PaymentService.verifyRazorpayPayment(req.body);
    res.status(200).json(new ApiResponse(200,result,"Payment verified successfully"));
});

