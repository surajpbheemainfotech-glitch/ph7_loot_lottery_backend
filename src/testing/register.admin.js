import { db } from "../config/db.js";
import JWT from 'jsonwebtoken'
import bcrypt from "bcryptjs"

export const  adminRegister = async(req,res) =>{
     
    const {email,password} = req.body
   
    if(!email || !password){
        return res.json({success: false})
    }

    const haash = await bcrypt.hash(password,10)

    const admin = await db.execute(`INSERT INTO  admin (email,password)VALUE(?,?) `,[email,haash])

    return res.json({success:true})
}