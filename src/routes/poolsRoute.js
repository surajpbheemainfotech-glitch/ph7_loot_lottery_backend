import express from 'express'
import {
    deletePoolById,
    getPool,
    updatePoolBySlug,
    createPool
} from '../controllers/poolsController.js'
import upload from '../config/multerConfig.js'
import { authenticate } from '../middlewares/authMiddleware.js'


const poolsRouter = express.Router()

poolsRouter.get('/', getPool)
poolsRouter.get("/get-pools", authenticate, getPool)

poolsRouter.post("/add-pools", authenticate, upload.single("Imageurl"), createPool)

poolsRouter.patch("/update-pool/:slug", authenticate, upload.single("Imageurl"), updatePoolBySlug)
poolsRouter.delete("/delete-pool/:id", authenticate, deletePoolById)


export default poolsRouter  