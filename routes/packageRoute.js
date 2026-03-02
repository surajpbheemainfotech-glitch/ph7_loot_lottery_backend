import express from 'express'
import { getPackages} from '../controllers/packageController.js'


const packageRouter = express.Router()

packageRouter.get('/',  getPackages)



export default packageRouter