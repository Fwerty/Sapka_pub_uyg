-- Admin rolünü geri ver
UPDATE users 
SET role = 'admin'
WHERE email = 'admin@admin.com';
