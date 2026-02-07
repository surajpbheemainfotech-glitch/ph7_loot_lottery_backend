import express from 'express'
import { declareResult, getPool } from '../controllers/poolsController.js'


const poolsRouter = express.Router()

poolsRouter.get('/', getPool)
poolsRouter.get("/result/:pool_name",declareResult)


export default poolsRouter  