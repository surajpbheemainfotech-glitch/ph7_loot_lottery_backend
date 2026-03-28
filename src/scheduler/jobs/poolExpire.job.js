import { updatePoolStatus } from "../services/pool.service.js";

export const poolExpireJob = async () => {
  await updatePoolStatus();
};
