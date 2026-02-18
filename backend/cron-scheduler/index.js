import cron from "node-cron";
import { poolExpireJob } from "./jobs/poolExpire.job.js";
import { declareResultsJob } from "./jobs/declareResult.job.js";
import { deleteExpirePool } from "./services/pool.service.js"; 

export const startPoolCron = () => {
  cron.schedule(
    "0 */6 * * *",
    async () => {
      console.log("🕒 Running pool maintenance job (every 6 hours, IST)...");

      await poolExpireJob();        
      await declareResultsJob();    
      await deleteExpirePool();     

      console.log("✅ Pool maintenance job done.\n");
    },
    {
      timezone: "Asia/Kolkata",
    }
  );


  // for otp table clear
  cron.schedule(
  "*/30 * * * *",
    async () => {
      console.log("🕒 Running OTP maintenance job (every 6 hours, IST)...");

      await deleteExpiredOtps();   

      console.log("✅ OTP maintenance job done.\n");
    },
    {
      timezone: "Asia/Kolkata",
    }
  );
};



//          just to memorize for me
//
//     Server start
//         ↓
//     Cron job (every X minutes)
//           ↓
//     updateExpiredPools()
//          ↓
//     declareResult()
//           ↓
//     deleteExpiredPools()
//          ↓
//     DB update (active → expired)
