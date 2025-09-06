const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

async function sendVerificationEmail(to, token) {
    const verifyUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/api/auth/verify-email?token=${token}`;
    await transporter.sendMail({
        from: process.env.SMTP_FROM || 'no-reply@bar.com',
        to,
        subject: 'E-posta Doğrulama',
        html: `<h3>Bar Yönetim Sistemi</h3><p>Hesabınızı doğrulamak için <a href="${verifyUrl}">buraya tıklayın</a>.</p>`
    });
}

module.exports = { sendVerificationEmail };
