import express from 'express'
import { authenticate } from '../middlewares/authMiddleware.js'
import { 
    addToCart, 
    getCart, 
    removeFromCart 
} from '../controllers/cart.controller.js'

const cartRouter = express.Router()

cartRouter.post("/add_to_cart",authenticate,addToCart)
cartRouter.get("/get_cartItems", authenticate, getCart)
cartRouter.delete("/remove_cartItems",authenticate, removeFromCart)

export default cartRouter