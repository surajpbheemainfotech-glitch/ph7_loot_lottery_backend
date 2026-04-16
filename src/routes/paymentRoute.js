import express from 'express'
import {
        approveWithdrawRequest, 
        createOrder, 
        executeWithdrawPayout, 
        getAllWithdrawRequests, 
        requestWithdrawAmount, 
         verifyPayment
         } from '../controllers/payment.controller.js'
import { authenticate } from '../middlewares/authMiddleware.js'

const paymentRoute = express.Router()

paymentRoute.post("/create-order",createOrder)
paymentRoute.post("/verify",verifyPayment)
paymentRoute.post("/withdraw-request",requestWithdrawAmount)
paymentRoute.post("/withdraw-approve",approveWithdrawRequest)
paymentRoute.post("/withdraw-payout",executeWithdrawPayout)
paymentRoute.get("/get-withdraw-requests",authenticate,getAllWithdrawRequests)

export default paymentRoute