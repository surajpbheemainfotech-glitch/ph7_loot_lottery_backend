import express from 'express'
import {
    buyCartTickets,
    deleteTicketByStatus,
    soldTickets
} from '../controllers/ticketController.js'
import { authenticate } from '../middlewares/authMiddleware.js'

const ticketRoute = express.Router()

ticketRoute.post('/buy', authenticate, buyCartTickets)
ticketRoute.get("/check_soldTic/:slug", authenticate, soldTickets)
ticketRoute.delete('/expire_delete', authenticate, deleteTicketByStatus)


export default ticketRoute