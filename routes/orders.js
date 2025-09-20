const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
const { body, param, validationResult } = require('express-validator');

// Create orders table if not exists
db.query(`CREATE TABLE IF NOT EXISTS schema_sapka_pub.orders (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES schema_sapka_pub.users(id),
    table_number INT NOT NULL,
    quantity INT NOT NULL,
    gift BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
)`).catch(err => console.log('orders table creation failed:', err.message));

// Add gift column if missing
db.query(`ALTER TABLE schema_sapka_pub.orders ADD COLUMN IF NOT EXISTS gift BOOLEAN DEFAULT false`).catch(err => console.log('gift column already exists or table not found'));
// Ek tanılama için istemci isteği kimliği
db.query(`ALTER TABLE schema_sapka_pub.orders ADD COLUMN IF NOT EXISTS client_request_id TEXT`).catch(err => console.log('client_request_id column already exists or table not found'));
// client_request_id için benzersiz kısıt (NULL'lar hariç)
// Unique index (NULL değerler birden fazla olabilir, Postgres'te sorun değil)
db.query(`DROP INDEX IF EXISTS schema_sapka_pub.orders_client_request_id_uidx`).catch(err => console.log('index drop failed:', err.message));
db.query(`CREATE UNIQUE INDEX IF NOT EXISTS schema_sapka_pub.orders_client_request_id_uidx ON schema_sapka_pub.orders (client_request_id)`).catch(err => console.log('index creation failed:', err.message));

// Middleware to check staff or admin
const checkStaff = async (req, res, next) => {
    try {
        const user = await db.query('SELECT role FROM schema_sapka_pub.users WHERE id = $1', [req.user.id]);
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
        const { tableNumber, quantity, gift, clientRequestId } = req.body;
        console.log('[POST /orders] incoming', {
            userId: req.user?.id, tableNumber, quantity, gift, clientRequestId,
            at: new Date().toISOString()
        });

        // Sunucu tarafında CRID üret (gelmediyse)
        const crid = clientRequestId || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const qty = parseInt(quantity, 10);

        // Tekilleştir: aynı client_request_id ikinci kez insert etmeyecek
        const insertResult = await db.query(
            `INSERT INTO schema_sapka_pub.orders (user_id, table_number, quantity, gift, client_request_id)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (client_request_id) DO NOTHING
             RETURNING id`,
            [req.user.id, tableNumber, qty, gift === true || gift === 'true', crid]
        );
        let orderId;
        if (insertResult.rows.length > 0) {
            orderId = insertResult.rows[0].id;
            console.log('[POST /orders] inserted', { orderId, clientRequestId: crid });
        } else {
            const existing = await db.query('SELECT id FROM schema_sapka_pub.orders WHERE client_request_id = $1', [crid]);
            orderId = existing.rows[0]?.id;
            console.log('[POST /orders] duplicate prevented, existing returned', { orderId, clientRequestId: crid });
        }
        // Immediately decrement free_beers for gift orders
        if (gift === true || gift === 'true') {
            await db.query('UPDATE schema_sapka_pub.users SET free_beers = free_beers - 1 WHERE id = $1', [req.user.id]);
        }
        res.json({ message: 'Siparişiniz alındı', orderId, clientRequestId: crid });
    } catch (err) {
        console.error('[POST /orders] error', err);
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
            'SELECT status FROM schema_sapka_pub.orders WHERE id = $1 AND user_id = $2',
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
            `SELECT o.id, o.user_id, o.table_number, o.quantity, o.gift, o.created_at, o.client_request_id, u.username
             FROM schema_sapka_pub.orders o
             JOIN schema_sapka_pub.users u ON o.user_id = u.id
             WHERE o.status = 'pending'
             ORDER BY o.created_at`
        );
        console.log('[GET /orders/pending] count', result.rows.length);
        if (result.rows.length) {
            console.log('[GET /orders/pending] ids', result.rows.map(r => ({ id: r.id, user_id: r.user_id, clientRequestId: r.client_request_id, at: r.created_at })));
        }
        res.set('Cache-Control', 'no-store');
        res.json(result.rows);
    } catch (err) {
        console.error('[GET /orders/pending] error', err);
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
        console.log('[POST /orders/:id/approve] start', { staffId: req.user?.id, orderId, at: new Date().toISOString() });
        // Get order
        const orderResult = await db.query('SELECT * FROM schema_sapka_pub.orders WHERE id = $1 AND status = $2', [orderId, 'pending']);
        if (orderResult.rows.length === 0) {
            console.warn('[POST /orders/:id/approve] not found/pending', { orderId });
            return res.status(404).json({ message: 'Order not found' });
        }
        const order = orderResult.rows[0];
        // Gift order handling
        if (order.gift) {
            // Record free beer usage (free_beers already decremented at creation)
            await db.query(
                'INSERT INTO schema_sapka_pub.beer_purchases (user_id, quantity, staff_id) VALUES ($1, $2, $3)',
                [order.user_id, 1, req.user.id]
            );
        } else {
            // Update user's beer count
            const result = await db.query(
                'UPDATE schema_sapka_pub.users SET beer_count = beer_count + $1 WHERE id = $2 RETURNING beer_count',
                [order.quantity, order.user_id]
            );
            const beerCount = result.rows[0].beer_count;
            // Free beer increment - use dynamic campaign threshold
            const campaignThreshold = await require('../config/settings').getCampaignThreshold();
            if (beerCount >= campaignThreshold) {
                await db.query(
                    'UPDATE schema_sapka_pub.users SET beer_count = beer_count - $1, free_beers = free_beers + 1 WHERE id = $2',
                    [campaignThreshold, order.user_id]
                );
            }
            // Insert purchase record
            await db.query(
                'INSERT INTO schema_sapka_pub.beer_purchases (user_id, quantity, staff_id) VALUES ($1, $2, $3)',
                [order.user_id, order.quantity, req.user.id]
            );
        }
        // Mark order as approved
        await db.query('UPDATE schema_sapka_pub.orders SET status = $1 WHERE id = $2', ['approved', orderId]);
        console.log('[POST /orders/:id/approve] done', { orderId });
        res.json({ message: 'Order approved' });
    } catch (err) {
        console.error('[POST /orders/:id/approve] error', err);
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
        console.log('[POST /orders/:id/reject] start', { staffId: req.user?.id, orderId, at: new Date().toISOString() });
        const result = await db.query(
            'UPDATE schema_sapka_pub.orders SET status = $1 WHERE id = $2 RETURNING id',
            ['rejected', orderId]
        );
        if (result.rowCount === 0) {
            console.warn('[POST /orders/:id/reject] not found/pending', { orderId });
            return res.status(404).json({ message: 'Order not found' });
        }
        console.log('[POST /orders/:id/reject] done', { orderId });
        res.json({ message: 'Order rejected' });
    } catch (err) {
        console.error('[POST /orders/:id/reject] error', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
