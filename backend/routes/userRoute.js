import express from 'express'
import { authValidateMiddleware } from '../middlewares/authValidateMiddleware.js'
import {  login, register, userDetailsById } from '../controllers/userController.js'
import { loginAuthValidateMiddleware } from '../middlewares/loginAuthValidateMiddleware.js'
import { fetchDummyUsers } from '../controllers/userController.js'
import { authenticate } from '../middlewares/authMiddleware.js'

const userRouter = express.Router()

userRouter.post("/register",authValidateMiddleware,register)
userRouter.post("/login",loginAuthValidateMiddleware,login)
userRouter.get("/get_dummy_users",authenticate,fetchDummyUsers)
userRouter.get("/user-profile/:id",userDetailsById)


export default userRouter