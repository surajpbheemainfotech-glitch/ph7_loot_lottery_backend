/**
 * Assign final top-3 winners based on real user percentage rules (UPGRADED).
 *
 * ✅ Improvements:
 * 1) Strict role enforcement (no "dummy required but real picked" bug)
 * 2) Uses score preference (higher score wins) with random tie-break
 * 3) Auto-fallback sequence: required pool → other pool (only if allowed) → any
 * 4) Supports role names: "user"/"real_user" + "dummy_user"
 * 5) Better errors + optional options
 *
 * @param {Array} candidateWinners - [{ user_id, role, score? }]
 * @param {number} realCount
 * @param {number} totalCount
 * @param {Object} options
 * @param {boolean} options.strict - if true: if required role not available => throw
 * @param {boolean} options.preferHighScore - if true: pick highest score instead of random
 * @returns {Array} [{ position:1|2|3, user_id, role }]
 */
export function sortWinners(
  candidateWinners,
  realCount,
  totalCount,
  options = {}
) {
  const { strict = true, preferHighScore = true } = options;

  if (!Array.isArray(candidateWinners) || candidateWinners.length === 0) {
    throw new Error("candidateWinners required");
  }
  if (!totalCount || totalCount <= 0) throw new Error("totalCount must be > 0");

  // normalize roles: allow "user" or "real_user"
  const normalized = candidateWinners
    .filter(Boolean)
    .map(w => ({
      user_id: w.user_id,
      role: w.role === "real_user" ? "user" : w.role, // normalize
      score: Number.isFinite(w.score) ? w.score : 0,
    }))
    .filter(w => w.user_id != null);

  const realPercent = (realCount / totalCount) * 100;

  const realPool = normalized.filter(w => w.role === "user");
  const dummyPool = normalized.filter(w => w.role === "dummy_user");

  const used = new Set();

  // Pick helper: prefers high score; tie-break random; no replacement
  const pickFromPool = (pool) => {
    const available = pool.filter(x => !used.has(x.user_id));
    if (!available.length) return null;

    if (!preferHighScore) {
      return available[Math.floor(Math.random() * available.length)];
    }

    // highest score; random tie break
    let bestScore = -Infinity;
    for (const a of available) bestScore = Math.max(bestScore, a.score);

    const best = available.filter(a => a.score === bestScore);
    return best[Math.floor(Math.random() * best.length)];
  };

  // Decide requirements per position:
  // D = dummy, R = real, N = any
  let req = { 1: "N", 2: "N", 3: "N" };

  if (realPercent < 50) {
    req = { 1: "D", 2: "D", 3: "D" };
  } else if (realPercent < 70) {
    req = { 1: "N", 2: "N", 3: "R" };
  } else if (realPercent < 90) {
    req = { 1: "N", 2: "R", 3: "R" };
  } else {
    req = { 1: "R", 2: "R", 3: "R" };
  }

  const pickAny = () => pickFromPool([...realPool, ...dummyPool]);

  const winners = [];

  for (const pos of [1, 2, 3]) {
    let chosen = null;

    if (req[pos] === "R") {
      chosen = pickFromPool(realPool);

      // If strict=false, allow fallback to anyone when real not available
      if (!chosen && !strict) chosen = pickAny();

      if (!chosen) {
        throw new Error(
          `Required REAL winner for position ${pos}, but realPool has no available candidates.`
        );
      }
    } else if (req[pos] === "D") {
      chosen = pickFromPool(dummyPool);

      // If strict=false, allow fallback to anyone when dummy not available
      if (!chosen && !strict) chosen = pickAny();

      if (!chosen) {
        throw new Error(
          `Required DUMMY winner for position ${pos}, but dummyPool has no available candidates.`
        );
      }
    } else {
      // N (any)
      chosen = pickAny();
      if (!chosen) {
        throw new Error(`Not enough unique candidates to fill position ${pos}`);
      }
    }

    used.add(chosen.user_id);
    winners.push({ position: pos, user_id: chosen.user_id, role: chosen.role });
  }

  return winners;
}
