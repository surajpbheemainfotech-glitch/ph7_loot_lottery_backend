export const getRealUsers = (tickets, logger) => {

  const realUsers = [...new Set(tickets.map(t => t.user_id))];

  logger.info(
    { realUserCount: realUsers.length },
    "Real users calculated"
  );

  return {
    realUsers,
    realUserCount: realUsers.length
  };
};