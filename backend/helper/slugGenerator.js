import { db } from "../config/db.js";

 export const makeSlug = (text) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
};

 export const makeUniqueSlug = async (title) => {
  const baseSlug = makeSlug(title);
  let slug = baseSlug;
  let count = 1;

  while (true) {
    const [rows] = await db.execute(
      "SELECT id FROM pools WHERE slug = ?",
      [slug]
    );

    if (!rows.length) break;
    slug = `${baseSlug}-${count++}`;
  }

  return slug;
};

