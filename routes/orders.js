const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
const { body, param, validationResult } = require('express-validator');

// Create orders table if not exists
db.query(`CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    table_number INT NOT NULL,
    quantity INT NOT NULL,
    gift BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
)`);

// Add gift column if missing
db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift BOOLEAN DEFAULT false`);

// Middleware to check staff or admin
const checkStaff = async (req, res, next) => {
    try {
        const user = await db.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
        if (!['staff', 'admin'].includes(user.rows[0].role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Place order (customer)
router.post('/', [
    auth,
    body('tableNumber').isInt({ min: 1 }).withMessage('Geçersiz masa numarası'),
    body('quantity').isInt({ min: 1 }).withMessage('Geçersiz miktar'),
    body('gift').optional().isBoolean().withMessage('gift boolean olmalıdır')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array().map(e => e.msg) });
        }
        const { tableNumber, quantity, gift } = req.body;

        // Insert order and return its ID
        const insertResult = await db.query(
            'INSERT INTO orders (user_id, table_number, quantity, gift) VALUES ($1, $2, $3, $4) RETURNING id',
            [req.user.id, tableNumber, quantity, gift === true || gift === 'true']
        );
        const orderId = insertResult.rows[0].id;
        // Immediately decrement free_beers for gift orders
        if (gift === true || gift === 'true') {
            await db.query('UPDATE users SET free_beers = free_beers - 1 WHERE id = $1', [req.user.id]);
        }
        res.json({ message: 'Siparişiniz alındı', orderId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get order status for customer
router.get('/:id/status', [
    auth,
    param('id').isInt().withMessage('Geçersiz sipariş ID')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array().map(e => e.msg) });
        }
        const orderId = req.params.id;
        const result = await db.query(
            'SELECT status FROM orders WHERE id = $1 AND user_id = $2',
            [orderId, req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ message: 'Order not found' });
        res.json({ status: result.rows[0].status });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get pending orders (staff/admin)
router.get('/pending', auth, checkStaff, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT o.id, o.table_number, o.quantity, o.gift, u.username
             FROM orders o
             JOIN users u ON o.user_id = u.id
             WHERE o.status = 'pending'
             ORDER BY o.created_at`
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Approve order
router.post('/:id/approve', [
    auth,
    checkStaff,
    param('id').isInt().withMessage('Geçersiz sipariş ID')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array().map(e => e.msg) });
        }
        const orderId = req.params.id;
        // Get order
        const orderResult = await db.query('SELECT * FROM orders WHERE id = $1 AND status = $2', [orderId, 'pending']);
        if (orderResult.rows.length === 0) return res.status(404).json({ message: 'Order not found' });
        const order = orderResult.rows[0];
        // Gift order handling
        if (order.gift) {
            // Record free beer usage (free_beers already decremented at creation)
            await db.query(
                'INSERT INTO beer_purchases (user_id, quantity, staff_id) VALUES ($1, $2, $3)',
                [order.user_id, 1, req.user.id]
            );
        } else {
            // Update user's beer count
            const result = await db.query(
                'UPDATE users SET beer_count = beer_count + $1 WHERE id = $2 RETURNING beer_count',
                [order.quantity, order.user_id]
            );
            const beerCount = result.rows[0].beer_count;
            // Free beer increment - use dynamic campaign threshold
            const campaignThreshold = await require('../config/settings').getCampaignThreshold();
            if (beerCount >= campaignThreshold) {
                await db.query(
                    'UPDATE users SET beer_count = beer_count - $1, free_beers = free_beers + 1 WHERE id = $2',
                    [campaignThreshold, order.user_id]
                );
            }
            // Insert purchase record
            await db.query(
                'INSERT INTO beer_purchases (user_id, quantity, staff_id) VALUES ($1, $2, $3)',
                [order.user_id, order.quantity, req.user.id]
            );
        }
        // Mark order as approved
        await db.query('UPDATE orders SET status = $1 WHERE id = $2', ['approved', orderId]);
        res.json({ message: 'Order approved' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Reject order
router.post('/:id/reject', [
    auth,
    checkStaff,
    param('id').isInt().withMessage('Geçersiz sipariş ID')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array().map(e => e.msg) });
        }
        const orderId = req.params.id;
        const result = await db.query(
            'UPDATE orders SET status = $1 WHERE id = $2 RETURNING id',
            ['rejected', orderId]
        );
        if (result.rowCount === 0) return res.status(404).json({ message: 'Order not found' });
        res.json({ message: 'Order rejected' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
