import express from 'express'
import { authValidateMiddleware } from '../middlewares/authValidateMiddleware.js'
import {
    fetchWallet,
    forgetPasswordByUserEmail,
    login,
    register,
    resetPasswordUser,
    updateUserWallet,
    userDetailsById,
    verifyForgotPasswordUserOtp
} from '../controllers/userController.js'
import { loginAuthValidateMiddleware } from '../middlewares/loginAuthValidateMiddleware.js'
import { authenticate } from '../middlewares/authMiddleware.js'



const userRouter = express.Router()

userRouter.post("/register", authValidateMiddleware, register)
userRouter.post("/login", loginAuthValidateMiddleware, login)
userRouter.post("/user-wallet-update",authenticate,updateUserWallet)
userRouter.post("/forget-password", forgetPasswordByUserEmail)
userRouter.post("/verify-otp", verifyForgotPasswordUserOtp)
userRouter.post("/reset-password", resetPasswordUser)

userRouter.get("/get_wallet/:id", authenticate, fetchWallet)
userRouter.get("/user-profile/:id", authenticate, userDetailsById)



export default userRouter