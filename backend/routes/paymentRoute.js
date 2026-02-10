import express from 'express'
import { createOrder, transferFund, verifyPayment } from '../controllers/paymentController.js'

const paymentRoute = express.Router()

paymentRoute.post("/create-order",createOrder)
paymentRoute.post("/verify",verifyPayment)
paymentRoute.post("/withdraw",transferFund)


export default paymentRoute