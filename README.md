# GTL Utsav Restaurant — Combined Application

## What's included
- **User Panel** — Book Table (with dine-in + pre-order), Order Online, Checkout, Order Tracker, Profile, Login/Register
- **Admin Panel** — Exact UI from Restaurant Software Application-2 (Dashboard, Menu, Orders, Tables, Billing, Inventory, Reports, Users)
- **Backend** — Flask API with modular routes; all user actions reflect in admin panel in real time

## Folder Structure
```
gtl_restaurant_backend/    Flask backend
gtl_restaurant_frontend/   React + Vite frontend
```

## Quick Start

### 1. Database
Open MySQL and run:
```sql
CREATE DATABASE gtl_utsav_db;
USE gtl_utsav_db;
SOURCE C:/path/to/gtl_restaurant_backend/schema.sql;
```

### 2. Backend — edit .env
```
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DB=gtl_utsav_db
```
Then run:
```bash
cd gtl_restaurant_backend
pip install -r requirements.txt
python app.py
# Runs on http://localhost:5000
```

### 3. Frontend (dev)
```bash
cd gtl_restaurant_frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

### 3. Frontend (production — serve via Flask)
```bash
cd gtl_restaurant_frontend
npm install
npm run build:deploy
# Then just run the backend — visit http://localhost:5000
```

## Credentials
| Role  | User ID | Password  |
|-------|---------|-----------|
| Admin | admin   | admin123  |

## User Flow
1. Register/Login at `/login`
2. **Book a Table** at `/book-table` — pick date, time, guests, optionally choose a table, optionally pre-order food (dine-in mode)
3. **Order Online** at `/order-online` — browse menu, add to cart, checkout
4. **Checkout** at `/checkout` — choose delivery or dine-in, enter details, place order
5. **Track Order** at `/order-tracker` — live status from backend

## Admin Panel (localhost:5173/admin)
All user orders (online + dine-in) appear instantly in:
- **Order Management** — view/update order status and payment
- **Table Management** — tables auto-update to occupied when dine-in orders placed
- **Reports & Analytics** — revenue and order data


uploaded upto Phase VI
