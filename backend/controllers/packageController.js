import { db } from "../config/db.js";


export const addPackage = async (req, res, next) => {
  const start = Date.now();
  const { package_name, package_price } = req.body;

  req.log.info(
    { action: "package.add", package_name, package_price },
    "Add package request"
  );

  try {
    if (!package_name || !package_price) {
      req.log.warn(
        { action: "package.add", reason: "missing_fields" },
        "Add package failed"
      );
      return res
        .status(400)
        .json({ success: false, message: "Package name and price required" });
    }

    const [result] = await db.execute(
      `INSERT INTO packages (package_name, package_price) VALUES (?, ?)`,
      [package_name, package_price]
    );

    // MySQL insert id
    const packageId = result?.insertId;

    req.log.info(
      { action: "package.add", packageId, durationMs: Date.now() - start },
      "Package added"
    );

    return res.status(201).json({
      success: true,
      message: "Package added successful",
      packageId,
    });
  } catch (err) {
    req.log.error(
      { action: "package.add", err, durationMs: Date.now() - start },
      "Add package crashed"
    );
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getPackages = async (req, res) => {
  const start = Date.now();

  req.log.info({ action: "package.list" }, "Get packages request");

  try {
    const [rows] = await db.execute(`
      SELECT id, package_name, package_price
      FROM packages
    `);

    req.log.info(
      { action: "package.list", count: rows.length, durationMs: Date.now() - start },
      "Packages fetched"
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (err) {
    req.log.error(
      { action: "package.list", err, durationMs: Date.now() - start },
      "Get packages crashed"
    );
    return res.status(500).json({
      success: false,
      message: "Failed to fetch packages",
    });
  }
};

export const updatePackageById = async (req, res) => {
  const start = Date.now();
  const { id } = req.params;
  const { package_name, package_price } = req.body;

  req.log.info(
    { action: "package.update", packageId: id, package_name, package_price },
    "Update package request"
  );

  try {
    const [found] = await db.execute(`SELECT * FROM packages WHERE id = ?`, [id]);

    if (!found.length) {
      req.log.warn(
        { action: "package.update", packageId: id, reason: "not_found" },
        "Update package failed"
      );
      return res.status(404).json({ success: false, message: "Package not found" });
    }

    const existing = found[0];
    const newPackageName = package_name ?? existing.package_name;
    const newPackagePrice = package_price ?? existing.package_price;

    await db.execute(
      `UPDATE packages SET package_name = ?, package_price = ? WHERE id = ?`,
      [newPackageName, newPackagePrice, id]
    );

    req.log.info(
      { action: "package.update", packageId: id, durationMs: Date.now() - start },
      "Package updated"
    );

    return res.json({ success: true, message: "Package updated" });
  } catch (err) {
    req.log.error(
      { action: "package.update", packageId: id, err, durationMs: Date.now() - start },
      "Update package crashed"
    );
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const deletePackageById = async (req, res) => {
  const start = Date.now();
  const { id } = req.params;

  req.log.info(
    { action: "package.delete", packageId: id },
    "Delete package request"
  );

  try {
    const [found] = await db.execute(`SELECT * FROM packages WHERE id = ?`, [id]);

    if (!found.length) {
      req.log.warn(
        { action: "package.delete", packageId: id, reason: "not_found" },
        "Delete package failed"
      );
      return res.status(404).json({ success: false, message: "Package not found" });
    }

    await db.execute(`DELETE FROM packages WHERE id = ?`, [id]);

    req.log.info(
      { action: "package.delete", packageId: id, durationMs: Date.now() - start },
      "Package deleted"
    );

    return res.json({ success: true, message: "Package deleted successfully" });
  } catch (err) {
    req.log.error(
      { action: "package.delete", packageId: id, err, durationMs: Date.now() - start },
      "Delete package crashed"
    );
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


