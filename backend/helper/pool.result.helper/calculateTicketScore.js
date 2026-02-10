/**
 * Ek ticket ke liye luck score calculate karta hai
 *
 * @param {number} userNumber - ticket.user_number
 * @param {number} drawCount - ticket.draw_number (kitni baar draw)
 * @param {number} min - random range min (default 0)
 * @param {number} max - random range max (default 99)
 */
export function calculateTicketScore(
  userNumber,
  drawCount,
  min = 0,
  max = 99
) {
  let score = 0;

  for (let i = 0; i < drawCount; i++) {
    const randomNumber =
      Math.floor(Math.random() * (max - min + 1)) + min;

    if (randomNumber === userNumber) {
      score++;
    }
  }

  return score;
}
