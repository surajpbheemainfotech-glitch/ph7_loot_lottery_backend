import express from 'express'
import {
    forgetPasswordByAdminEmail,
    loginController,
    resetPasswordAdmin,
    verifyForgotPasswordAdminOtp
} from '../controllers/adminController.js'
import { adminRegister } from '../testing/register.admin.js'
import poolsRouter from './poolsRoute.js'
import packageRouter from './packageRoute.js'
import paymentRoute from './paymentRoute.js'


const adminRouter = express.Router()

//admin login 

adminRouter.post("/login", loginController)
adminRouter.post("/forget-password", forgetPasswordByAdminEmail)
adminRouter.post("/verify-otp", verifyForgotPasswordAdminOtp)
adminRouter.post("/reset-password", resetPasswordAdmin)
adminRouter.post("/res",adminRegister)

//pools

adminRouter.use("/pool",poolsRouter)

// packages

adminRouter.use("/package",packageRouter)

//withdraw requests
adminRouter.use("/payment", paymentRoute)


export default adminRouter