import express from 'express'
import {
    forgetPasswordByAdminEmail,
    loginController,
    resetPasswordAdmin,
    verifyForgotPasswordAdminOtp
} from '../controllers/adminController.js'
import { authenticate } from '../middlewares/authMiddleware.js'
import {
    createPool,
    deletePoolById,
    getPool,
    updatePoolBySlug
} from '../controllers/poolsController.js'
import {
    addPackage,
    deletePackageById,
    getPackages,
    updatePackageById
} from '../controllers/packageController.js'
import upload from '../config/multerConfig.js'


const adminRouter = express.Router()

//admin login 

adminRouter.post("/login", loginController)
adminRouter.post("/forget-password", forgetPasswordByAdminEmail)
adminRouter.post("/verify-otp", verifyForgotPasswordAdminOtp)
adminRouter.post("/reset-password", resetPasswordAdmin)


//pools

adminRouter.post("/add-pools", authenticate, upload.single("Imageurl"), createPool)
adminRouter.get("/pools", authenticate, getPool)
adminRouter.patch("/pool/:slug", authenticate, upload.single("Imageurl"), updatePoolBySlug)
adminRouter.delete("/pool/:id", authenticate, deletePoolById)

// packages

adminRouter.post("/package/add", authenticate, addPackage)
adminRouter.get("/package/", authenticate, getPackages)
adminRouter.patch("/package/update-package/:id", authenticate, updatePackageById)
adminRouter.delete("/package/delete-package/:id", authenticate, deletePackageById)

export default adminRouter