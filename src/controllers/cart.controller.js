import { db } from '../config/db.js'

export const addToCart = async (req, res) => {
    const start = Date.now();

    const userId = req.user.id;
    const { pool_id, ticket_price, ticket_quantity } = req.body;

    req.log.info(
        { action: "cart.add", userId, pool_id, ticket_price, ticket_quantity },
        "Add to cart request"
    );

    if (!userId) {
        req.log.warn({ action: "cart.add", reason: "unauthorized" });
        return res.status(403).json({ success: false, message: "Unauthorized." });
    }

    if (!pool_id || !ticket_price || !ticket_quantity) {
        req.log.warn({ action: "cart.add", reason: "missing_fields" });
        return res.status(400).json({ success: false, message: "Missing required fields." });
    }

    try {
        const total_price = ticket_price * ticket_quantity;

        const [existingCart] = await db.execute(
            `SELECT id FROM carts WHERE user_id = ? AND status = 'active' LIMIT 1`,
            [userId]
        );

        let cartId;

        if (existingCart.length === 0) {
            const [newCart] = await db.execute(
                `INSERT INTO carts (user_id, total_amount) VALUES (?, ?)`,
                [userId, total_price]
            );
            cartId = newCart.insertId;

            req.log.info({ action: "cart.add", cartId }, "New cart created");
        } else {
            cartId = existingCart[0].id;
        }

        const [existingItem] = await db.execute(
            `SELECT id, ticket_quantity FROM cart_items WHERE cart_id = ? AND pool_id = ?`,
            [cartId, pool_id]
        );

        if (existingItem.length > 0) {
            const newQty = existingItem[0].ticket_quantity + ticket_quantity;

            await db.execute(
                `UPDATE cart_items 
                 SET ticket_quantity = ?, price_per_ticket = ?, updated_at = NOW()
                 WHERE id = ?`,
                [newQty, ticket_price, existingItem[0].id]
            );

            req.log.info(
                { action: "cart.add", cartId, pool_id, newQty },
                "Cart item updated"
            );
        } else {
            await db.execute(
                `INSERT INTO cart_items 
                (cart_id, pool_id, ticket_quantity, price_per_ticket) 
                VALUES (?, ?, ?, ?)`,
                [cartId, pool_id, ticket_quantity, ticket_price]
            );

            req.log.info(
                { action: "cart.add", cartId, pool_id },
                "New item added to cart"
            );
        }

        const [cartTotal] = await db.execute(
            `SELECT SUM(ticket_quantity * price_per_ticket) AS total 
             FROM cart_items WHERE cart_id = ?`,
            [cartId]
        );

        const finalTotal = cartTotal[0].total || 0;

        await db.execute(
            `UPDATE carts SET total_amount = ? WHERE id = ?`,
            [finalTotal, cartId]
        );

        req.log.info(
            { action: "cart.add", cartId, finalTotal, durationMs: Date.now() - start },
            "Cart updated successfully"
        );

        return res.status(200).json({
            success: true,
            message: "Item added to cart successfully"
        });

    } catch (error) {
        req.log.error(
            { action: "cart.add", error, durationMs: Date.now() - start },
            "Add to cart failed"
        );

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

export const removeFromCart = async (req, res) => {
    const start = Date.now();

    const userId = req.user.id;
    const { pool_id } = req.body;

    req.log.info(
        { action: "cart.remove", userId, pool_id },
        "Remove from cart request"
    );

    if (!userId) {
        req.log.warn({ action: "cart.remove", reason: "unauthorized" });
        return res.status(403).json({ success: false, message: "Unauthorized." });
    }

    if (!pool_id) {
        req.log.warn({ action: "cart.remove", reason: "missing_pool_id" });
        return res.status(400).json({ success: false, message: "pool_id is required." });
    }

    try {
        const [cart] = await db.execute(
            `SELECT id FROM carts WHERE user_id = ? AND status = 'active' LIMIT 1`,
            [userId]
        );

        if (cart.length === 0) {
            req.log.warn({ action: "cart.remove", reason: "cart_not_found" });
            return res.status(404).json({ success: false, message: "Cart not found." });
        }

        const cartId = cart[0].id;

        const [result] = await db.execute(
            `DELETE FROM cart_items WHERE cart_id = ? AND pool_id = ?`,
            [cartId, pool_id]
        );

        if (result.affectedRows === 0) {
            req.log.warn({ action: "cart.remove", cartId, pool_id, reason: "item_not_found" });
            return res.status(404).json({ success: false, message: "Item not found in cart." });
        }

        const [cartTotal] = await db.execute(
            `SELECT SUM(ticket_quantity * price_per_ticket) AS total 
             FROM cart_items WHERE cart_id = ?`,
            [cartId]
        );

        const newTotal = cartTotal[0].total || 0;

        await db.execute(
            `UPDATE carts SET total_amount = ? WHERE id = ?`,
            [newTotal, cartId]
        );

        if (newTotal === 0) {
            await db.execute(`DELETE FROM carts WHERE id = ?`, [cartId]);
            req.log.info({ action: "cart.remove", cartId }, "Cart deleted (empty)");
        }

        req.log.info(
            { action: "cart.remove", cartId, newTotal, durationMs: Date.now() - start },
            "Item removed from cart"
        );

        return res.status(200).json({
            success: true,
            message: "Item removed from cart"
        });

    } catch (error) {
        req.log.error(
            { action: "cart.remove", error, durationMs: Date.now() - start },
            "Remove from cart failed"
        );

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

export const getCart = async (req, res) => {
    const start = Date.now();

    const userId = req.user.id;

    req.log.info({ action: "cart.get", userId }, "Get cart request");

    if (!userId) {
        req.log.warn({ action: "cart.get", reason: "unauthorized" });
        return res.status(403).json({ success: false, message: "Unauthorized." });
    }

    try {
        const [cart] = await db.execute(
            `SELECT id, total_amount 
             FROM carts 
             WHERE user_id = ? AND status = 'active' 
             LIMIT 1`,
            [userId]
        );

        if (cart.length === 0) {
            req.log.info(
                { action: "cart.get", userId, durationMs: Date.now() - start },
                "Empty cart"
            );

            return res.status(200).json({
                success: true,
                cart: null,
                items: []
            });
        }

        const cartId = cart[0].id;

        const [items] = await db.execute(
            `SELECT 
                ci.id, ci.pool_id, ci.ticket_quantity, ci.price_per_ticket,
                (ci.ticket_quantity * ci.price_per_ticket) AS total_price,
                p.title AS pool_title, p.price AS current_price
             FROM cart_items ci
             JOIN pools p ON ci.pool_id = p.id
             WHERE ci.cart_id = ?`,
            [cartId]
        );

        req.log.info(
            { action: "cart.get", cartId, itemCount: items.length, durationMs: Date.now() - start },
            "Cart fetched"
        );

        return res.status(200).json({
            success: true,
            cart: {
                id: cartId,
                total_amount: cart[0].total_amount
            },
            items
        });

    } catch (error) {
        req.log.error(
            { action: "cart.get", error, durationMs: Date.now() - start },
            "Get cart failed"
        );

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};