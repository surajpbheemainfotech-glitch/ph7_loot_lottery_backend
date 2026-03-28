import { createDailyPools } from "../services/add.pool.daily.js";
import { deleteExpirePool } from "../services/pool.service.js";

export const composePools = async()=>{
    await deleteExpirePool()
    // await createDailyPools()
}