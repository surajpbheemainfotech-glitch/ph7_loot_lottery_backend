import express from 'express'
import {
    getResults,
    getResultWinnersByPoolName,
    getUserResultById
} from '../controllers/result.controller.js'
import { authenticate } from '../middlewares/authMiddleware.js'

const resultRouter = express.Router()

resultRouter.get("/user-result/:id",authenticate, getUserResultById)
resultRouter.get("/:title",authenticate, getResultWinnersByPoolName)
resultRouter.get("/all_results/:id",authenticate, getResults)

export default resultRouter