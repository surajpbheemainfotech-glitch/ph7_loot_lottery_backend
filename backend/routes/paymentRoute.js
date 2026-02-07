import express from 'express'
import { createOrder, verifyPayment } from '../controllers/paymentController.js'

const paymentRoute = express.Router()

paymentRoute.post("/create-order",createOrder)
paymentRoute.post("/verify",verifyPayment)


export default paymentRoute