const db = require('./db');

let cachedThreshold = null;
let cachedTableCount = null;

async function getCampaignThreshold() {
    if (cachedThreshold !== null) return cachedThreshold;
    try {
        const res = await db.query("SELECT value FROM schema_sapka_pub.settings WHERE key = 'campaign_threshold'");
        const val = res.rows[0]?.value;
        cachedThreshold = parseInt(val, 10) || 10;
    } catch (err) {
        // If settings table doesn't exist or query fails, default to 10
        cachedThreshold = 10;
    }
    return cachedThreshold;
}

async function setCampaignThreshold(threshold) {
    const exists = await db.query("SELECT 1 FROM schema_sapka_pub.settings WHERE key = 'campaign_threshold'");
    if (exists.rows.length) {
        await db.query("UPDATE schema_sapka_pub.settings SET value = $1 WHERE key = 'campaign_threshold'", [String(threshold)]);
    } else {
        await db.query("INSERT INTO schema_sapka_pub.settings (key, value) VALUES ('campaign_threshold', $1)", [String(threshold)]);
    }
    cachedThreshold = threshold;
}

async function getTableCount() {
    try {
        const res = await db.query("SELECT value FROM schema_sapka_pub.settings WHERE key = 'table_count'");
        const val = res.rows[0]?.value;
        return parseInt(val, 10) || 20;
    } catch (err) {
        return 20;
    }
}

async function setTableCount(count) {
    const exists = await db.query("SELECT 1 FROM schema_sapka_pub.settings WHERE key = 'table_count'");
    if (exists.rows.length) {
        await db.query("UPDATE schema_sapka_pub.settings SET value = $1 WHERE key = 'table_count'", [String(count)]);
    } else {
        await db.query("INSERT INTO schema_sapka_pub.settings (key, value) VALUES ('table_count', $1)", [String(count)]);
    }
    cachedTableCount = count;
}

module.exports = { getCampaignThreshold, setCampaignThreshold, getTableCount, setTableCount };
