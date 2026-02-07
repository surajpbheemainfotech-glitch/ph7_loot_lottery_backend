import cron from "node-cron";
import { updatePoolStatus,deleteExpirePool } from "../../controllers/poolsController.js";


export  const startPoolCron = () => {

  cron.schedule(
    "0 */6 * * *",
    async () => {
      console.log(" Running pool maintenance job (every 6 hours, IST)...");

      await updatePoolStatus();
      await deleteExpirePool();

      console.log(" Pool maintenance job done.\n");
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
//     deleteExpiredPools()
//          ↓
//     DB update (active → expired)
