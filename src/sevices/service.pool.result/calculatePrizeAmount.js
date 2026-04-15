export const calculatePrizeAmount = (
  totalPrize,
  position,
  logger
) => {

  if (!totalPrize || totalPrize <= 0) {
    throw new Error("Invalid total prize amount");
  }

  const percentageMap = {
    1: 25,
    2: 20,
    3: 15
  };

  const percentage = percentageMap[position] || 0;

  const prizeAmount =
    Math.floor((totalPrize * percentage) / 100);

  logger?.info(
    {
      action: "prize.calculate",
      position,
      percentage,
      prizeAmount
    },
    "Prize calculated"
  );

  return prizeAmount;
};