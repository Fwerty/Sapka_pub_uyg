const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

// Get user profile
router.get('/profile', auth, async (req, res) => {
    try {
        const user = await db.query(
            'SELECT id, username, role, beer_count, free_beers FROM schema_sapka_pub.users WHERE id = $1',
            [req.user.id]
        );

        res.json(user.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get user's beer history
router.get('/beer-history', auth, async (req, res) => {
    try {
        const history = await db.query(
            'SELECT * FROM schema_sapka_pub.beer_purchases WHERE user_id = $1 ORDER BY purchase_date DESC',
            [req.user.id]
        );

        res.json(history.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Admin: Get all users
router.get('/all', auth, async (req, res) => {
    try {
        // Check if admin
        const user = await db.query(
            'SELECT role FROM schema_sapka_pub.users WHERE id = $1',
            [req.user.id]
        );

        if (user.rows[0].role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const users = await db.query(
            'SELECT id, username, role, beer_count FROM schema_sapka_pub.users'
        );

        res.json(users.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
