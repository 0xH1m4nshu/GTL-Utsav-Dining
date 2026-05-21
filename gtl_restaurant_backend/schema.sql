-- GTL Utsav Dining — Database Setup
-- Run this in MySQL before starting the app

CREATE DATABASE IF NOT EXISTS gtl_utsav_db;
USE gtl_utsav_db;

CREATE TABLE IF NOT EXISTS users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       VARCHAR(50)  UNIQUE NOT NULL,
    email         VARCHAR(100) UNIQUE NOT NULL,
    password      VARCHAR(255) NOT NULL DEFAULT '',
    google_id     VARCHAR(100) DEFAULT NULL,
    mfa_secret    VARCHAR(64)  DEFAULT NULL,
    mfa_enabled   TINYINT(1)   DEFAULT 0,
    full_name     VARCHAR(120) DEFAULT NULL,
    phone         VARCHAR(20)  DEFAULT NULL,
    role          ENUM('customer','staff','admin') NOT NULL DEFAULT 'customer',
    is_active     TINYINT(1)   NOT NULL DEFAULT 1,
    last_login_at TIMESTAMP    NULL DEFAULT NULL,
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Email OTPs for login verification
CREATE TABLE IF NOT EXISTS email_otps (
    token      VARCHAR(128) PRIMARY KEY,
    user_id    VARCHAR(50)  NOT NULL,
    email      VARCHAR(100) NOT NULL,
    code       VARCHAR(6)   NOT NULL,
    expires_at DATETIME     NOT NULL,
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Table bookings
CREATE TABLE IF NOT EXISTS bookings (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT          DEFAULT NULL,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(100) NOT NULL,
    phone       VARCHAR(20)  NOT NULL,
    date        DATE         NOT NULL,
    time        TIME         NOT NULL,
    guests      INT          NOT NULL DEFAULT 2,
    message     TEXT         DEFAULT NULL,
    table_id    INT          DEFAULT NULL,
    status      ENUM('pending','confirmed','cancelled') NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Table orders
CREATE TABLE IF NOT EXISTS orders (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT          DEFAULT NULL,
    items       TEXT         NOT NULL,
    total       DECIMAL(10,2) NOT NULL,
    address     TEXT         NOT NULL,
    status      VARCHAR(30)  DEFAULT 'pending',
    kitchen_accepted_by VARCHAR(50) DEFAULT NULL,
    kitchen_accepted_at TIMESTAMP NULL DEFAULT NULL,
    order_type  ENUM('online','dine_in') NOT NULL DEFAULT 'online',
    table_id    INT          DEFAULT NULL,
    payment_status ENUM('unpaid','paid','refunded') NOT NULL DEFAULT 'unpaid',
    payment_method VARCHAR(50) DEFAULT NULL,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Order items for reporting
CREATE TABLE IF NOT EXISTS order_items (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    order_id   INT NOT NULL,
    item_id    INT DEFAULT NULL,
    item_name  VARCHAR(150) NOT NULL,
    qty        INT NOT NULL DEFAULT 1,
    price      DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- Menu items managed by admin
CREATE TABLE IF NOT EXISTS menu_items (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(150) NOT NULL,
    description  TEXT         DEFAULT NULL,
    price        DECIMAL(10,2) NOT NULL DEFAULT 0,
    category     VARCHAR(80)  NOT NULL,
    image_url    TEXT         DEFAULT NULL,
    is_available TINYINT(1)   NOT NULL DEFAULT 1,
    is_veg       TINYINT(1)   NOT NULL DEFAULT 1,
    is_spicy     TINYINT(1)   NOT NULL DEFAULT 0,
    created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Inventory items
CREATE TABLE IF NOT EXISTS inventory_items (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(150) NOT NULL,
    unit          VARCHAR(30)  NOT NULL DEFAULT 'pcs',
    stock_qty     DECIMAL(10,2) NOT NULL DEFAULT 0,
    reorder_level DECIMAL(10,2) NOT NULL DEFAULT 0,
    updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Customer feedback
CREATE TABLE IF NOT EXISTS feedback (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    VARCHAR(50) DEFAULT NULL,
    rating     INT NOT NULL,
    comment    TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Login / system activity
CREATE TABLE IF NOT EXISTS login_activity (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    VARCHAR(50) NOT NULL,
    action     VARCHAR(50) NOT NULL DEFAULT 'login',
    ip_address VARCHAR(64) DEFAULT NULL,
    user_agent TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Restaurant tables (for occupancy)
CREATE TABLE IF NOT EXISTS restaurant_tables (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    table_code   VARCHAR(20) UNIQUE NOT NULL,
    seats        INT          NOT NULL DEFAULT 4,
    status       ENUM('available','reserved','occupied') NOT NULL DEFAULT 'available',
    updated_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Optional: table occupancy history (for analytics)
CREATE TABLE IF NOT EXISTS table_occupancy_events (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    table_id   INT NOT NULL,
    status     ENUM('available','reserved','occupied') NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (table_id) REFERENCES restaurant_tables(id)
);

-- If upgrading existing DB, run:
-- ALTER TABLE users ADD COLUMN mfa_secret VARCHAR(64) DEFAULT NULL;
-- ALTER TABLE users ADD COLUMN mfa_enabled TINYINT(1) DEFAULT 0;
-- ALTER TABLE users ADD COLUMN full_name VARCHAR(120) DEFAULT NULL;
-- ALTER TABLE users ADD COLUMN phone VARCHAR(20) DEFAULT NULL;
-- ALTER TABLE users ADD COLUMN role ENUM('customer','staff','admin') NOT NULL DEFAULT 'customer';
-- ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;
-- ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP NULL DEFAULT NULL;
-- ALTER TABLE orders ADD COLUMN order_type ENUM('online','dine_in') NOT NULL DEFAULT 'online';
-- ALTER TABLE orders ADD COLUMN table_id INT DEFAULT NULL;
-- ALTER TABLE orders ADD COLUMN payment_status ENUM('unpaid','paid','refunded') NOT NULL DEFAULT 'unpaid';
-- ALTER TABLE orders ADD COLUMN payment_method VARCHAR(50) DEFAULT NULL;
-- ALTER TABLE orders ADD COLUMN kitchen_accepted_by VARCHAR(50) DEFAULT NULL;
-- ALTER TABLE orders ADD COLUMN kitchen_accepted_at TIMESTAMP NULL DEFAULT NULL;
-- ALTER TABLE orders ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
-- ALTER TABLE bookings ADD COLUMN table_id INT DEFAULT NULL;
-- ALTER TABLE bookings ADD COLUMN status ENUM('pending','confirmed','cancelled') NOT NULL DEFAULT 'pending';
-- CREATE TABLE menu_items ( ... );
-- CREATE TABLE order_items ( ... );
-- CREATE TABLE inventory_items ( ... );
-- CREATE TABLE feedback ( ... );
-- CREATE TABLE login_activity ( ... );
-- CREATE TABLE restaurant_tables ( ... );
-- CREATE TABLE table_occupancy_events ( ... );

-- ══════════════════════════════════════════════════════════════
-- FIX: Run these if upgrading an existing database to fix the
-- "Incorrect integer value: 'guest'" errors
-- ══════════════════════════════════════════════════════════════
-- ALTER TABLE bookings MODIFY COLUMN user_id INT DEFAULT NULL;
-- ALTER TABLE orders   MODIFY COLUMN user_id INT DEFAULT NULL;
