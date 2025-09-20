-- schema_sapka_pub şemasını oluştur
CREATE SCHEMA IF NOT EXISTS schema_sapka_pub;

-- Users table
CREATE TABLE schema_sapka_pub.users (
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
CREATE TABLE schema_sapka_pub.beer_purchases (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES schema_sapka_pub.users(id),
    staff_id INT REFERENCES schema_sapka_pub.users(id),
    quantity INT NOT NULL,
    purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settings table
CREATE TABLE schema_sapka_pub.settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(50) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE schema_sapka_pub.orders (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES schema_sapka_pub.users(id),
    table_number INT NOT NULL,
    quantity INT NOT NULL,
    gift BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'pending',
    client_request_id TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Pending users table
CREATE TABLE schema_sapka_pub.pending_users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE,
    password TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_purchases_user_id ON schema_sapka_pub.beer_purchases(user_id);
CREATE INDEX idx_purchases_date ON schema_sapka_pub.beer_purchases(purchase_date);
CREATE UNIQUE INDEX orders_client_request_id_uidx ON schema_sapka_pub.orders (client_request_id);
