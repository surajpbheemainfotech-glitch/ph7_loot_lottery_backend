export const determineRealWinnerRules = (
  realUserCount,
  totalUsers,
  logger
) => {

  const percent =
    (realUserCount / totalUsers) * 100;

  let rules = [false, false, false];

  if (percent > 90) rules = [true, true, true];
  else if (percent > 80) rules = [false, true, true];
  else if (percent > 70) rules = [false, Math.random() > 0.5, true];
  else if (percent > 50) rules = [false, false, true];

  logger.info(
    { realUserPercent: percent, rules },
    "Real winner rules calculated"
  );

  return rules;
};