import express from 'express'
import {
    getPool,
    getResultWinnersByPoolName,
    getUserResultById
} from '../controllers/poolsController.js'


const poolsRouter = express.Router()

poolsRouter.get('/', getPool)
poolsRouter.get("/result/:title", getResultWinnersByPoolName)
poolsRouter.get("/user-result/:id",getUserResultById)


export default poolsRouter  