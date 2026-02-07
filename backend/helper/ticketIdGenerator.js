
const generateTicketId = (poolName) => {
  const prefix = "LP";
  const pool = poolName.toUpperCase().replace(/\s+/g, "");
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(1000 + Math.random() * 9000); // 4 digit

  return `${prefix}-${pool}-${random}-${date}`;
};

export default generateTicketId