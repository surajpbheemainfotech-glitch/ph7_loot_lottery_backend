export const selectWinners = async (
  tickets,
  realUsers,
  dummyUsers,
  rules,
  logger
) => {

  const ticketMap = new Map();

  for (const t of tickets) {
    if (!ticketMap.has(t.ticket_number)) {
      ticketMap.set(t.ticket_number, []);
    }
    ticketMap.get(t.ticket_number).push(t);
  }

  const usedUsers = new Set();
  const winners = [];

  for (let pos = 1; pos <= 3; pos++) {

    const winningNumber =
      Math.floor(Math.random() * 100) + 1;

    let winner = null;

    if (rules[pos - 1] && ticketMap.has(winningNumber)) {

      const candidates =
        ticketMap
          .get(winningNumber)
          .filter(t => !usedUsers.has(t.user_id));

      if (candidates.length) {

        winner =
          candidates[
            Math.floor(Math.random() * candidates.length)
          ];
      }
    }

    if (!winner) {

      const dummy =
        dummyUsers[
          Math.floor(Math.random() * dummyUsers.length)
        ];

      winner = {
        user_id: dummy,
        ticket_number: winningNumber,
        role: "dummy_user"
      };

    } else {
      winner.role = "user";
    }

    usedUsers.add(winner.user_id);

    winners.push({
      position: pos,
      user_id: winner.user_id,
      ticket_number: winner.ticket_number,
      role: winner.role
    });
  }

  logger.info({ winners }, "Winners selected");

  return winners;
};