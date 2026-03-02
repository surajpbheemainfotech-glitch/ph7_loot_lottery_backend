import express from 'express'
import { buyTicket, deleteTicketByStatus } from '../controllers/ticketController.js'
import { authenticate } from '../middlewares/authMiddleware.js'

const ticketRoute = express.Router()

ticketRoute.post('/buy',authenticate,buyTicket)
ticketRoute.delete('/expire_delete',authenticate,deleteTicketByStatus)


export default ticketRoute