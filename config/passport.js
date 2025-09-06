const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('./db');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BASE_URL}/api/auth/google/callback`
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Google hesabından gelen bilgiler
        const email = profile.emails[0].value;
        const username = profile.displayName;

        // Kullanıcı var mı kontrol et
        let user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (user.rows.length === 0) {
            // Yeni kullanıcı oluştur
            user = await db.query(
                'INSERT INTO users (username, email, password, role, is_verified, google_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                [username, email, 'GOOGLE_AUTH', 'customer', true, profile.id]
            );
        } else {
            // Google ID'yi güncelle
            await db.query('UPDATE users SET google_id = $1 WHERE email = $2', [profile.id, email]);
        }

        done(null, user.rows[0]);
    } catch (err) {
        done(err, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await db.query('SELECT * FROM users WHERE id = $1', [id]);
        done(null, user.rows[0]);
    } catch (err) {
        done(err, null);
    }
});

module.exports = passport;
