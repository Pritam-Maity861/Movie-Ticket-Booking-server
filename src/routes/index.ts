import { Router } from "express";
import authRouter from "../modules/auth/auth.route";
import movieRouter from "../modules/movie/movie.route";
import theaterRouter from "../theaters/theaters.routes";
import screenRouter from "../modules/screen/screen.routes";
import showtimeRouter from "../modules/showtime/showtime.routes";
import bookingRouter from "../modules/booking/booking.route";
import paymentRouter from "../modules/payment/payment.route";
import adminRouter from "../modules/admin/admin.route";
import theaterOwnerRouter from "../modules/approval/theaterOwner.routes";
import adminApprovalRouter from "../modules/approval/adminApproval.routes";

const AllRouter = Router();

AllRouter.use("/auth", authRouter);
AllRouter.use("/movie", movieRouter);
AllRouter.use("/theaters", theaterRouter);
AllRouter.use("/screen", screenRouter);
AllRouter.use("/showtime", showtimeRouter);
AllRouter.use("/booking", bookingRouter);
AllRouter.use("/payments", paymentRouter);
AllRouter.use("/admin", adminRouter);
AllRouter.use("/admin/approvals", adminApprovalRouter);
AllRouter.use("/theater-owner", theaterOwnerRouter);

export default AllRouter;
