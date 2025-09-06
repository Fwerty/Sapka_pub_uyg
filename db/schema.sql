-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'customer',
    beer_count INT DEFAULT 0,
    free_beers INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Beer purchases table
CREATE TABLE beer_purchases (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    staff_id INT REFERENCES users(id),
    quantity INT NOT NULL,
    purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_purchases_user_id ON beer_purchases(user_id);
CREATE INDEX idx_purchases_date ON beer_purchases(purchase_date);
