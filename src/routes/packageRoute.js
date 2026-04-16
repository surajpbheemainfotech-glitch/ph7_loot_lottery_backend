import express from 'express'
import { 
    addPackage,
     deletePackageById,
      getPackages,
       updatePackageById
    } from '../controllers/package.controller.js'
import { authenticate } from '../middlewares/authMiddleware.js'


const packageRouter = express.Router()

packageRouter.get('/',  getPackages)
packageRouter.post("/add", authenticate, addPackage)
packageRouter.get("/get-package", authenticate, getPackages)
packageRouter.patch("/update-package/:id", authenticate, updatePackageById)
packageRouter.delete("/delete-package/:id", authenticate, deletePackageById)



export default packageRouter