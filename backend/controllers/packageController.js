import { db } from "../config/db.js";


export const addPackage = async (req, res) => {

    try {
        const { package_name, package_price } = req.body


        if (!package_name || !package_price) {
            return res.status(400).json({ success: false, message: "Package name and price required" })
        }

        await db.execute(
            `INSERT INTO packages (package_name, package_price)
       VALUES (?, ?)`,
            [package_name, package_price]
        );

        return res.status(201).json({
            success: true,
            message: "Package added successful",

        });

    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}

export const getPackages = async (req, res) => {
    console.log("frontend is here..")
    try {
        const [rows] = await db.execute(`
      SELECT
        id,
        package_name,
        package_price
      FROM packages
    `);

        return res.status(200).json({
            success: true,
            count: rows.length,
            data: rows,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch packages",
        });
    }
};

export const updatePackageById = async (req, res) => {
    try {
        const { id } = req.params;


        const [found] = await db.execute(
            `SELECT * FROM packages WHERE id = ?`,
            [id]
        );

        if (!found.length) {
            return res.status(404).json({
                success: false,
                message: "Package not found",
            });
        }

        const existing = found[0];

        const { package_name, package_price } = req.body;

        const newPackageName = package_name ?? existing.package_name;
        const newPackagePrice = package_price ?? existing.package_price;


        await db.execute(
            `UPDATE packages
           SET package_name = ?, package_price = ? WHERE id = ?`,
            [newPackageName, newPackagePrice, id]
        );

        res.json({
            success: true,
            message: "Package updated ",
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

export const deletePackageById = async (req, res) => {
    try {
        const { id } = req.params;

        const [found] = await db.execute(`
            SELECT * FROM packages WHERE id = ?`, [id]
        );

        if (!found.length) {
            return res.status(404).json({
                success: false,
                message: "Package not found"
            });
        }

        await db.execute(`DELETE FROM packages WHERE id = ?`, [id]);


        return res.json({
            success: true,
            message: "Package deleted successfully"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
}


