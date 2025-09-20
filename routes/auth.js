const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

// Ensure fields for login attempts
db.query(`ALTER TABLE schema_sapka_pub.users ADD COLUMN IF NOT EXISTS failed_attempts INTEGER DEFAULT 0`).catch(err => console.log('failed_attempts column already exists or table not found'));
db.query(`ALTER TABLE schema_sapka_pub.users ADD COLUMN IF NOT EXISTS lock_until TIMESTAMP NULL`).catch(err => console.log('lock_until column already exists or table not found'));

// Create pending_users table
db.query(`CREATE TABLE IF NOT EXISTS schema_sapka_pub.pending_users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE,
    password TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
)`).catch(err => console.log('pending_users table creation failed:', err.message));

// Register with input validation
router.post('/register', [
    body('username')
        .trim()
        .isAlphanumeric().withMessage('Kullanıcı adı sadece harf ve rakam içermelidir')
        .isLength({ min: 3 }).withMessage('Kullanıcı adı en az 3 karakter olmalıdır'),
    body('password')
        .isLength({ min: 5 }).withMessage('Şifre en az 5 karakter olmalıdır')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array().map(e => e.msg) });
        }
        const { username, password } = req.body;

        // Check if user exists
        const userExists = await db.query(
            'SELECT * FROM schema_sapka_pub.users WHERE username = $1',
            [username]
        );

        if (userExists.rows.length > 0) {
            return res.status(400).json({ message: 'Bu kullanıcı adı zaten kayıtlı. Lütfen başka bir kullanıcı adı seçin.' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Store in pending_users
        await db.query(
            'INSERT INTO schema_sapka_pub.pending_users (username, password) VALUES ($1, $2)',
            [username, hashedPassword]
        );

        return res.status(201).json({ message: 'Kayıt başarılı. Onayınız bekleniyor.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login with input validation
router.post('/login', [
    body('username').trim().notEmpty().withMessage('Kullanıcı adı zorunludur'),
    body('password').notEmpty().withMessage('Şifre zorunludur')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array().map(e => e.msg) });
        }
        const { username, password } = req.body;

        // Check lock status
        const now = new Date();
        const userRow = await db.query('SELECT failed_attempts, lock_until, password, role, id FROM schema_sapka_pub.users WHERE username = $1', [username]);
        if (userRow.rows.length === 0) return res.status(400).json({ message: 'Kullanıcı bulunamadı' });
        const user = userRow.rows[0];
        if (user.lock_until && now < user.lock_until) {
            const remaining = Math.ceil((user.lock_until - now) / 60000);
            return res.status(403).json({ message: `Hesabınız ${remaining} dakika kilitli` });
        }
        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            // Increment failed attempts
            let attempts = user.failed_attempts + 1;
            let lockUntil = null;
            let msg;
            if (attempts >= 5) {
                lockUntil = new Date(now.getTime() + 15 * 60000);
                msg = '5 başarısız girişten dolayı hesabınız 15 dakika kilitlenmiştir.';
                attempts = 5;
            } else {
                msg = `Şifre yanlış. Kalan hakkınız: ${5 - attempts}`;
            }
            await db.query('UPDATE schema_sapka_pub.users SET failed_attempts = $1, lock_until = $2 WHERE username = $3', [attempts, lockUntil, username]);
            return res.status(400).json({ message: msg });
        }
        // Reset counters on success
        await db.query('UPDATE schema_sapka_pub.users SET failed_attempts = 0, lock_until = NULL WHERE username = $1', [username]);
        // Generate token
        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Staff check middleware
const checkStaff = async (req, res, next) => {
    try {
        const user = await db.query('SELECT role FROM schema_sapka_pub.users WHERE id = $1', [req.user.id]);
        if (!['staff', 'admin'].includes(user.rows[0].role)) {
            return res.status(403).json({ message: 'Yetkiniz yok' });
        }
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Sunucu hatası' });
    }
};

// Pending users endpoints
router.get('/pending-users', auth, checkStaff, async (req, res) => {
    try {
        const result = await db.query('SELECT id, username FROM schema_sapka_pub.pending_users ORDER BY created_at');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/pending-users/:id/approve', auth, checkStaff, async (req, res) => {
    try {
        const { id } = req.params;
        const userRes = await db.query('SELECT * FROM schema_sapka_pub.pending_users WHERE id = $1', [id]);
        if (userRes.rows.length === 0) return res.status(404).json({ message: 'Pending user not found' });
        const pendingUser = userRes.rows[0];
        await db.query('INSERT INTO schema_sapka_pub.users (username, password) VALUES ($1, $2)', [pendingUser.username, pendingUser.password]);
        await db.query('DELETE FROM schema_sapka_pub.pending_users WHERE id = $1', [id]);
        res.json({ message: 'Kullanıcı onaylandı' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/pending-users/:id/reject', auth, checkStaff, async (req, res) => {
    try {
        const { id } = req.params;
        const delRes = await db.query('DELETE FROM schema_sapka_pub.pending_users WHERE id = $1', [id]);
        if (delRes.rowCount === 0) return res.status(404).json({ message: 'Pending user not found' });
        res.json({ message: 'Kullanıcı reddedildi' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
