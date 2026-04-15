import { fetchDummyUsers } from "../service.pool.result/fetchDummyUsers.js";

export const buildUserSnapshot = async (conn, realUsers, logger) => {

  const realCount = realUsers.length;

  const needed = Math.max(0, 100 - realCount);

  let dummyUsers = [];

  if (needed > 0) {

    const { data } =
      await fetchDummyUsers(conn, needed * 2);

    dummyUsers =
      data
        .map(u => u.id)
        .filter(id => !realUsers.includes(id))
        .slice(0, needed);
  }

  logger.info(
    {
      realUsers: realCount,
      dummyUsers: dummyUsers.length
    },
    "User snapshot prepared"
  );

  return {
    dummyUsers,
    totalUsers: realCount + dummyUsers.length
  };
};