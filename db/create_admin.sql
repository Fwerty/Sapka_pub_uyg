-- Admin kullanıcısı oluştur (şifre: admin123)
INSERT INTO users (username, email, password, role)
VALUES (
    'admin',
    'admin@admin.com',
    '$2a$10$rYTJxiHkbKsEQqTXm1cAqOQqTY6lNnqnDEqO6H0meY9HQhQVx0i/y', -- hash of 'admin123'
    'admin'
);
