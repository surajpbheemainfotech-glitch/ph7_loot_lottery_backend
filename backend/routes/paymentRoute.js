import express from 'express'
import {
        approveWithdrawRequest, 
        createOrder, 
        executeWithdrawPayout, 
        requestWithdrawAmount, 
         verifyPayment
         } from '../controllers/paymentController.js'

const paymentRoute = express.Router()

paymentRoute.post("/create-order",createOrder)
paymentRoute.post("/verify",verifyPayment)
paymentRoute.post("/withdraw-request",requestWithdrawAmount)
paymentRoute.post("/withdraw-approve",approveWithdrawRequest)
paymentRoute.post("/withdraw-payout",executeWithdrawPayout)


export default paymentRoute