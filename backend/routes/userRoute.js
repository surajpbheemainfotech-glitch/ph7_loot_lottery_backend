import express from 'express'
import { authValidateMiddleware } from '../middlewares/authValidateMiddleware.js'
import {  login, register, userDetailsById } from '../controllers/userController.js'
import { loginAuthValidateMiddleware } from '../middlewares/loginAuthValidateMiddleware.js'
import { authenticate } from '../middlewares/authMiddleware.js'

const userRouter = express.Router()

userRouter.post("/register",authValidateMiddleware,register)
userRouter.post("/login",loginAuthValidateMiddleware,login)
userRouter.get("/user-profile/:id",authenticate,userDetailsById)


export default userRouter