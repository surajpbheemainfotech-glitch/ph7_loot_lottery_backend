/**
 * Calculate prize amount based on position percentage
 *
 * @param {number} totalPrize - total prize pool amount
 * @param {number} position - 1 | 2 | 3
 *
 * @returns {number} prize amount
 */
export function calculatePrizeAmount(totalPrize, position) {
  if (!totalPrize || totalPrize <= 0) {
    throw new Error("Invalid total prize amount");
  }

  const percentageMap = {
    1: 25,
    2: 20,
    3: 15,
  };

  const percentage = percentageMap[position] || 0;

  return Math.floor((totalPrize * percentage) / 100);
}
