import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import dotenv from 'dotenv'
import {startPoolCron} from './config/cron-scheduler/cronConfig.js'
import { connectDB } from './config/db.js'
import adminRouter from './routes/adminRoute.js'
import userRouter from './routes/userRoute.js'
import poolsRouter from './routes/poolsRoute.js'
import uploadErrorHandler from './middlewares/multerMiddleware.js'
import ticketRoute from './routes/ticketRoute.js'
import paymentRoute from './routes/paymentRoute.js'
import packageRouter from './routes/packageRoute.js'
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000
const HOST = process.env.HOST

app.use(cors(
   { origin: ["http://localhost:5173","http://10.189.140.145:5173","http://localhost:5174"],
    
    credentials: true
   }
))
app.use(express.json())
app.use(express.urlencoded({extended: true}))
app.use(cookieParser())
app.use("/uploads",express.static("uploads"))

//database 
 await connectDB();

 //routes
 app.use("/api/admin",adminRouter)
 app.use("/api/user",userRouter)
 app.use("/api/pool",poolsRouter)
 app.use("/api/ticket",ticketRoute)
 app.use("/api/payment",paymentRoute)
 app.use("/api/package",packageRouter)
 
 app.use(uploadErrorHandler)
 
app.get('/',(req,res)=>{
    res.send(`server is running on ${PORT}..`)
})

app.listen(PORT, HOST, ()=>{
    console.log(`server is running on ${PORT}..`)
    startPoolCron()
    
})