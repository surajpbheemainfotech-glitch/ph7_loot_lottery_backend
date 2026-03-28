export const winnerDetails = async (conn, finalWinners, title) => {
  if (!Array.isArray(finalWinners) || finalWinners.length === 0) return [];

  const winnerIds = finalWinners.map(w => String(w.user_id));

  // 1) Users
  const [users] = await conn.query(
    `SELECT id AS user_id, first_name, last_name
     FROM users
     WHERE id IN (?)`,
    [winnerIds]
  );

  // 2) Tickets for this pool
  const [poolTickets] = await conn.query(
    `SELECT user_id, user_number
     FROM tickets
     WHERE TRIM(LOWER(pool_name)) = TRIM(LOWER(?))`,
    [title]
  );

  const userMap = new Map(users.map(u => [String(u.user_id), u]));

  const ticketMap = new Map();
  for (const t of poolTickets) {
    const k = String(t.user_id);
    const n = Number(t.user_number);

    if (!Number.isFinite(n)) continue;
    if (n < 1 || n > 100) continue; 

    if (!ticketMap.has(k) || n < ticketMap.get(k)) {
      ticketMap.set(k, n);
    }
  }


  const usedNumbers = new Set([...ticketMap.values()].map(String));

  const randomUniqueNumber = () => {
 
    for (let tries = 0; tries < 200; tries++) {
      const n = Math.floor(Math.random() * 100) + 1; // 1..100
      const key = String(n);
      if (!usedNumbers.has(key)) {
        usedNumbers.add(key);
        return n;
      }
    }

    for (let n = 1; n <= 100; n++) {
      const key = String(n);
      if (!usedNumbers.has(key)) {
        usedNumbers.add(key);
        return n;
      }
    }
    return 1;
  };

  const takeUniqueOrRandom = (preferred) => {
    const n = Number(preferred);
    if (Number.isFinite(n) && n >= 1 && n <= 100 && !usedNumbers.has(String(n))) {
      usedNumbers.add(String(n));
      return n;
    }
    return randomUniqueNumber();
  };

  // 3) Merge winners
  return finalWinners.map(w => {
    const k = String(w.user_id);
    const u = userMap.get(k) || {};


    const preferred = w.role === "user" ? ticketMap.get(k) : null;
    const user_number = takeUniqueOrRandom(preferred);

    return {
      position: w.position,
      role: w.role,
      first_name: u.first_name ?? null,
      last_name: u.last_name ?? null,
      user_number,
    };
  });
};
