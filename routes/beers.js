const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
//deneme
// Add beer purchase for customer (Bar staff only)
router.post('/purchase', auth, async (req, res) => {
    try {
        const { customerId, quantity } = req.body;

        // Check if staff member
        const staff = await db.query(
            'SELECT role FROM users WHERE id = $1',
            [req.user.id]
        );

        if (staff.rows[0].role !== 'staff' && staff.rows[0].role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized' });
        }

        console.log('Purchase endpoint hit for user', customerId, 'quantity', quantity);
        // Add purchase and update customer's beer count
        const result = await db.query(
            'UPDATE users SET beer_count = beer_count + $1 WHERE id = $2 RETURNING beer_count',
            [quantity, customerId]
        );

        // Check if customer gets a free beer
        const beerCount = result.rows[0].beer_count;
        let freeBeerEarned = false;

        const campaignThreshold = await require('../config/settings').getCampaignThreshold();
        if (beerCount >= campaignThreshold) {
            await db.query(
                'UPDATE users SET beer_count = beer_count - $1, free_beers = free_beers + 1 WHERE id = $2',
                [campaignThreshold, customerId]
            );
            freeBeerEarned = true;
        }

        console.log('Inserting beer_purchases record for user', customerId, 'quantity', quantity);
        // Record the purchase
        await db.query('INSERT INTO beer_purchases (user_id, quantity, staff_id) VALUES ($1, $2, $3)', [customerId, quantity, req.user.id]);
        console.log('Purchase recorded successfully for user', customerId);
        // Debug: check total purchases rows
        const totalRowsAfter = await db.query('SELECT COUNT(*)::int AS count FROM beer_purchases');
        console.log('Total beer_purchases rows after purchase:', totalRowsAfter.rows[0].count);

        res.json({
            message: 'Purchase recorded successfully',
            newBeerCount: beerCount,
            freeBeerEarned
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// QR kod ile müşteri bira sayısını arttır veya hediye QR kodunu işler (Personel/Admin)
router.post('/scan', auth, async (req, res) => {
    try {
        const { qrData } = req.body;
        if (!qrData || typeof qrData !== 'string') {
            return res.status(400).json({ message: 'Geçersiz QR kodu' });
        }
        // Sadece staff veya admin yetkisi
        const staff = await db.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
        if (!['staff', 'admin'].includes(staff.rows[0].role)) {
            return res.status(403).json({ message: 'Yetkisiz' });
        }
        // Hediye kodu mu kontrolü
        if (qrData.includes('|hediye|')) {
            // Format: username|hediye|timestamp
            const [username, hediye, timeStr] = qrData.split('|');
            if (!username || hediye !== 'hediye') {
                return res.status(400).json({ message: 'Geçersiz hediye QR kodu' });
            }
            // Kullanıcıyı bul
            const userResult = await db.query('SELECT id, beer_count FROM users WHERE username = $1', [username]);
            if (userResult.rows.length === 0) {
                return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
            }
            const userId = userResult.rows[0].id;
            const beerCount = userResult.rows[0].beer_count;
            // Hediye QR kodu okutulduğunda beer_count tam 10 veya 11 ise sıfırla (buton sonrası hemen okutulursa 10, bir artırılmışsa 11 olabilir)
            if (beerCount === 10 || beerCount === 11) {
                await db.query('UPDATE users SET beer_count = 0, free_beers = free_beers + 1 WHERE id = $1', [userId]);
                res.json({ message: 'Müşteri hediye bira kazandı!', userId, gift: true });
            } else {
                res.status(400).json({ message: 'Hediye QR kodu sadece 10 veya 11. birada okutulabilir!' });
            }
            return;
        }
        // Normal QR kod: username|YYYY-MM-DD-HH:MM
        if (!qrData.includes('|')) {
            return res.status(400).json({ message: 'Geçersiz QR kodu' });
        }
        const [username, timeStr] = qrData.split('|');
        // Validate QR timestamp against current time
        const tsParts = timeStr.split(/[-:]/).map(Number); // [YYYY,MM,DD,HH,mm]
        if (tsParts.length !== 5) {
            return res.status(400).json({ message: 'Geçersiz QR zamanı' });
        }
        const [y, mo, d, h, mi] = tsParts;
        const now = new Date();
        if (y !== now.getFullYear() || mo !== now.getMonth() + 1 || d !== now.getDate() || h !== now.getHours() || mi !== now.getMinutes()) {
            return res.status(400).json({ message: 'Lütfen tekrar deneyiniz' });
        }
        if (!username || !timeStr) {
            return res.status(400).json({ message: 'Geçersiz QR kodu' });
        }
        // Kullanıcıyı bul
        const userResult = await db.query('SELECT id, beer_count FROM users WHERE username = $1', [username]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
        }
        const userId = userResult.rows[0].id;
        // Bira sayısını arttır
        await db.query('UPDATE users SET beer_count = beer_count + 1 WHERE id = $1', [userId]);
        console.log('Scan endpoint insert for user', userId);
        // Satın alım kaydı ekle
        await db.query('INSERT INTO beer_purchases (user_id, quantity, staff_id) VALUES ($1, $2, $3)', [userId, 1, req.user.id]);
        console.log('Scan recorded successfully for user', userId);
        // Debug: check total purchases rows after scan
        const totalRowsScan = await db.query('SELECT COUNT(*)::int AS count FROM beer_purchases');
        console.log('Total beer_purchases rows after scan:', totalRowsScan.rows[0].count);
        res.json({ message: 'Bira eklendi', userId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Sunucu hatası' });
    }
});

// Get beer statistics (Admin only)
router.get('/stats', auth, async (req, res) => {
    try {
        // Check if admin
        const user = await db.query(
            'SELECT role FROM users WHERE id = $1',
            [req.user.id]
        );

        if (user.rows[0].role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Get total beers sold
        const totalBeers = await db.query(
            'SELECT SUM(quantity) as total FROM beer_purchases'
        );

        // Get today's beers sold
        const todayBeers = await db.query(
            "SELECT COALESCE(SUM(quantity),0) as total FROM beer_purchases WHERE DATE(purchase_date) = CURRENT_DATE"
        );

        // Get top customers
        const topCustomers = await db.query(
            'SELECT u.username, SUM(bp.quantity) as total_beers FROM users u JOIN beer_purchases bp ON u.id = bp.user_id GROUP BY u.id, u.username ORDER BY total_beers DESC LIMIT 5'
        );

        res.json({
            beersSoldToday: todayBeers.rows[0].total,
            totalBeersSold: totalBeers.rows[0].total,
            topCustomers: topCustomers.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
