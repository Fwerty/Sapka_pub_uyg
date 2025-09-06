require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// CSP ayarları
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://www.google.com", "https://www.gstatic.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            connectSrc: ["'self'", "https://www.google.com", "https://maximum-minnow-lucky.ngrok-free.app:5000", "https://maximum-minnow-lucky.ngrok-free.app:5000"],
            frameSrc: ["'self'", "https://www.google.com"],
            frameAncestors: ["'self'"],
            formAction: ["'self'", "https://accounts.google.com"],
            objectSrc: ["'none'"]
        }
    }
}));

// Statik dosyaları servis et
app.use(express.static('public'));

// Trust proxy headers (e.g. X-Forwarded-For) when behind ngrok or other proxies
app.set('trust proxy', 1);

// Rate limiter for auth routes (login/registration)
const authLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // limit each IP to 20 requests per minute
    message: 'Too many auth attempts, please try again later'
});
app.use('/api/auth', authLimiter, require('./routes/auth'));

// Rate limiting (global)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 dakika
    max: 1000, // IP başına maksimum istek (increased)
    message: 'Too many requests, please try again later'
});
// Apply general limiter after auth
app.use(limiter);

// Other Routes
app.use('/api/users', require('./routes/users'));
app.use('/api/beers', require('./routes/beers'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/orders', require('./routes/orders'));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Removed session middleware since only username/password auth is used
// Removed Passport since only username/password auth is used

const PORT = process.env.PORT || 5000;

//! aşağısı önceden şu şekildeydi  ,  telden localhost a bağlanmak için değitim geri alırsın sonra

// app.listen(PORT, () => {
//     console.log(`Server is running on port ${PORT}`);
// });


app.listen(PORT,'0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});



// ufak bir değişiklik 


// anderson talisca