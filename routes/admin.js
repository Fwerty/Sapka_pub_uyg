const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

// Admin yetkisi kontrolü
const checkAdmin = async (req, res, next) => {
    try {
        const user = await db.query('SELECT role FROM schema_sapka_pub.users WHERE id = $1', [req.user.id]);
        if (user.rows[0].role !== 'admin') {
            return res.status(403).json({ message: 'Admin yetkisi gerekli' });
        }
        next();
    } catch (err) {
        res.status(500).json({ message: 'Sunucu hatası' });
    }
};

// Campaign threshold settings
const { getCampaignThreshold, setCampaignThreshold, getTableCount, setTableCount } = require('../config/settings');

// Tüm kullanıcıları getir
router.get('/users', auth, checkAdmin, async (req, res) => {
    try {
        const users = await db.query(
            'SELECT id, username, role, beer_count, free_beers, created_at FROM schema_sapka_pub.users ORDER BY created_at DESC'
        );
        res.json(users.rows);
    } catch (err) {
        console.error('Admin /users error:', err);
        res.status(500).json({ message: err.message || 'Sunucu hatası' });
    }
});

// Get current campaign threshold
router.get('/settings/campaign_threshold', auth, checkAdmin, async (req, res) => {
    try {
        const threshold = await getCampaignThreshold();
        res.json({ threshold });
    } catch (err) {
        res.status(500).json({ message: 'Sunucu hatası' });
    }
});

// Tüm satın alım geçmişini getir
router.get('/purchases', auth, checkAdmin, async (req, res) => {
    try {
        const purchases = await db.query(
            `SELECT 
                bp.id, 
                u.username as customer_name,
                s.username as staff_name,
                bp.quantity,
                bp.purchase_date
            FROM schema_sapka_pub.beer_purchases bp
            JOIN schema_sapka_pub.users u ON bp.user_id = u.id
            JOIN schema_sapka_pub.users s ON bp.staff_id = s.id
            ORDER BY bp.purchase_date DESC`
        );
        res.json(purchases.rows);
    } catch (err) {
        console.error('Admin /purchases error:', err);
        res.status(500).json({ message: err.message || 'Sunucu hatası' });
    }
});

// Update campaign threshold
router.put('/settings/campaign_threshold', auth, checkAdmin, async (req, res) => {
    try {
        const { threshold } = req.body;
        const val = parseInt(threshold, 10);
        if (isNaN(val) || val < 1) {
            return res.status(400).json({ message: 'Geçersiz eşik değeri' });
        }
        await setCampaignThreshold(val);
        res.json({ threshold: val });
    } catch (err) {
        res.status(500).json({ message: 'Sunucu hatası' });
    }
});

// Kullanıcı rolünü güncelle
router.put('/users/:id/role', auth, checkAdmin, async (req, res) => {
    try {
        const { role } = req.body;
        const { id } = req.params;

        if (!['customer', 'staff', 'admin'].includes(role)) {
            return res.status(400).json({ message: 'Geçersiz rol' });
        }

        await db.query(
            'UPDATE schema_sapka_pub.users SET role = $1 WHERE id = $2',
            [role, id]
        );
        res.json({ message: 'Rol güncellendi' });
    } catch (err) {
        res.status(500).json({ message: 'Sunucu hatası' });
    }
});

// Kullanıcıyı sil
router.delete('/users/:id', auth, checkAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        // Delete beer purchase records
        await db.query('DELETE FROM schema_sapka_pub.beer_purchases WHERE user_id = $1', [id]);
        // Delete orders associated with user to avoid FK constraint
        await db.query('DELETE FROM schema_sapka_pub.orders WHERE user_id = $1', [id]);
        // Delete user
        await db.query('DELETE FROM schema_sapka_pub.users WHERE id = $1', [id]);
        res.json({ message: 'Kullanıcı silindi' });
    } catch (err) {
        res.status(500).json({ message: 'Sunucu hatası' });
    }
});

// Get current table count
router.get('/settings/table_count', auth, checkAdmin, async (req, res) => {
    try {
        const tableCount = await getTableCount();
        res.json({ tableCount });
    } catch (err) {
        res.status(500).json({ message: 'Sunucu hatası' });
    }
});

// Update table count
router.put('/settings/table_count', auth, checkAdmin, async (req, res) => {
    try {
        const { tableCount } = req.body;
        const val = parseInt(tableCount, 10);
        if (isNaN(val) || val < 1) {
            return res.status(400).json({ message: 'Geçersiz masa sayısı' });
        }
        await setTableCount(val);
        res.json({ tableCount: val });
    } catch (err) {
        res.status(500).json({ message: 'Sunucu hatası' });
    }
});

// Masa sayısını tüm kullanıcılar için (public) dönen endpoint
router.get('/public/table_count', async (req, res) => {
    try {
        const tableCount = await getTableCount();
        res.json({ tableCount });
    } catch (err) {
        res.status(500).json({ message: 'Sunucu hatası' });
    }
});

module.exports = router;
