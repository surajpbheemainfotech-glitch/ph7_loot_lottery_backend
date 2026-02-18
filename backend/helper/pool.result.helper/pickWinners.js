import { calculateTicketScore } from "./calculateTicketScore.js";

export function pickWinners(tickets, limit = 30) {
  // ✅ No tickets = no real candidates (NOT an error)
  if (!Array.isArray(tickets) || tickets.length === 0) return [];

  const scoredTickets = tickets.map(t => ({
    ...t,
    score: calculateTicketScore(t.user_number, t.draw_number),
  }));

  scoredTickets.sort((a, b) => b.score - a.score || (Math.random() - 0.5));

  const winners = [];
  const usedUsers = new Set();

  for (const ticket of scoredTickets) {
    if (!usedUsers.has(ticket.user_id)) {
      winners.push({ user_id: ticket.user_id, score: ticket.score });
      usedUsers.add(ticket.user_id);
    }
    if (winners.length === limit) break;
  }

  return winners;
}
