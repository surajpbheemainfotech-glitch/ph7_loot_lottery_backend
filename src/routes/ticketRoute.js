import express from 'express'
import { buyCartTickets,  deleteTicketByStatus } from '../controllers/ticketController.js'
import { authenticate } from '../middlewares/authMiddleware.js'

const ticketRoute = express.Router()

ticketRoute.post('/buy',authenticate,buyCartTickets)
ticketRoute.delete('/expire_delete',authenticate,deleteTicketByStatus)


export default ticketRoute