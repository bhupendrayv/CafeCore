# CafeCore — Cafe Management System

> A full-stack, role-based Point-of-Sale and Cafe Management platform for modern cafes.
> Built with **Node.js · Express · SQLite · Vanilla JS**

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express)
![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?style=flat-square&logo=sqlite)
![Stripe](https://img.shields.io/badge/Stripe-Payment%20Gateway-635BFF?style=flat-square&logo=stripe)
![JWT](https://img.shields.io/badge/JWT-Auth-pink?style=flat-square)
![License](https://img.shields.io/badge/License-ISC-blue?style=flat-square)

---

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Architectural Layers and Responsibilities](#architectural-layers-and-responsibilities)
- [Key Modules and Capabilities](#key-modules-and-capabilities)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Local Development Setup](#local-development-setup)
- [Default Credentials](#default-credentials)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)

---

## Overview

**CafeCore** is a two-server full-stack cafe management application branded as **Aura Cafe**. It provides:

- **Point-of-Sale (POS)** — Real-time order placement with cart management
- **Order Tracking** — Live kitchen view of pending and delivered orders
- **Menu Management** — Admin-gated CRUD for menu items
- **Analytics Dashboard** — Revenue trends, top items, payment breakdowns with Chart.js
- **Payment Gateway** — Stripe Card, UPI, Digital Wallet, Net Banking, Cash
- **Role-Based Access Control** — Admin, Manager, Barista, Cashier roles with JWT auth

---

## System Architecture

The project contains **two independent server stacks**:

```
+------------------------------------------------------------------+
|                        CLIENT LAYER                              |
|                                                                  |
|   client/                          frontend/                     |
|   +-- login.html                   +-- index.html  (SPA)        |
|   +-- signup.html                  +-- script.js  (~1665 lines) |
|   +-- style.css                    +-- inject_charts.js         |
|                                    +-- style.css                 |
|   Auth UI -> MySQL server          +-- assets/ (food images)    |
|         |                                    |                   |
+---------|------------------------------------|--------------------|
          | HTTP REST (port 5000)              | HTTP REST (port 5001)
          v                                    v
+------------------------------------------------------------------+
|                        SERVER LAYER                              |
|                                                                  |
|   server/  (Auth MVC)              backend/  (Main POS)         |
|   +-- server.js                    +-- server.js (monolith)     |
|   +-- config/db.js                 +-- db.js                    |
|   +-- routes/authRoutes.js         +-- seed_data.sql            |
|   +-- controllers/authCtrl.js      +-- update_prices.js         |
|   +-- models/userModel.js          +-- .env                     |
|         |                                    |                   |
+---------|------------------------------------|--------------------|
          v                                    v
+------------------------------------------------------------------+
|                       DATABASE LAYER                             |
|                                                                  |
|   MySQL (cafe_db)                  SQLite (WAL mode)            |
|   +-- users table                  cafe_management.sqlite        |
|       id, name, email,             +-- Staff                    |
|       password                     +-- Customer                  |
|   (legacy auth only)               +-- Menu                     |
|                                    +-- Orders                   |
|                                    +-- Order_Details            |
|                                    +-- Payment                  |
+------------------------------------------------------------------+
```

> **Note:**
> - `server/` handles a legacy MySQL-based auth flow serving the `client/` HTML pages.
> - `backend/` is the primary production server powering the full SPA at `frontend/`.

---

## Architectural Layers and Responsibilities

### 1. Presentation Layer — frontend/ and client/

| File | Responsibility |
|------|----------------|
| `frontend/index.html` | Single-page application shell — all 4 tabs rendered in one HTML file |
| `frontend/script.js` | ~1,665-line SPA controller: auth, POS cart, order placement, admin gating, voice recognition, payment gateway, analytics |
| `frontend/style.css` | Full custom CSS — dark theme, glassmorphism cards, animated micro-interactions |
| `frontend/inject_charts.js` | Node.js build utility — injects Chart.js rendering logic into script.js |
| `client/login.html` | Standalone login page served by the `server/` auth module |
| `client/signup.html` | Standalone signup page served by the `server/` auth module |

**Frontend Responsibilities:**
- JWT session management via `localStorage` (`aura_token`, `aura_staff`)
- Role-based UI gating — Admin/Manager privilege checks before destructive actions
- Real-time cart state management and checkout flow
- Chart.js analytics rendering (Line, Doughnut, Bar charts)

---

### 2. Application / API Layer — backend/ and server/

#### Primary Backend — backend/server.js

A single-file Express monolith exposing all 16 REST endpoints:

| Responsibility | Details |
|----------------|---------|
| Staff Auth | JWT sign-in (`/api/login`, `/api/signup`), bcrypt password hashing |
| Admin Authorization | `/api/admin/verify` + `requireAdmin` middleware enforcing Admin or Manager roles |
| Menu CRUD | Public `GET`; admin-gated `POST` / `PUT` / `DELETE` |
| Order Processing | Customer lookup/create → order record → line-item insertion → payment record |
| Receipt Generation | 5-table JOIN query producing a full itemized receipt |
| Order Tracking | Active `Pending` orders + `PUT /deliver` with delivery timestamp and elapsed time |
| Analytics | Aggregated stats: total sales, top items, revenue by method, daily trends, top customers |
| Payment Gateway | Stripe Hosted Checkout, Stripe PaymentIntent, UPI/wallet verification stub |

#### Auth Module — server/ (MVC Pattern)

| Layer | File | Responsibility |
|-------|------|----------------|
| Route | `routes/authRoutes.js` | Mounts `/api/signup` and `/api/login` |
| Controller | `controllers/authController.js` | Input validation, password hashing, JWT signing |
| Model | `models/userModel.js` | MySQL query abstraction — `findByEmail()`, `create()` |
| Config | `config/db.js` | MySQL2 connection pool, auto-creates `cafe_db` and `users` table |

---

### 3. Data Layer — SQLite and MySQL

#### SQLite — Primary Database (backend/db.js)

- Uses `better-sqlite3` in **WAL (Write-Ahead Logging)** mode for concurrent reads
- Foreign key constraints enforced via `PRAGMA foreign_keys = ON`
- Auto-seeded on first boot: default Admin, Manager, Barista accounts + full menu items
- Synchronous API wrapped to remain Express-compatible

#### MySQL — Legacy Auth Database (server/config/db.js)

- Uses `mysql2/promise` with a connection pool (10 connections max)
- Auto-creates the `cafe_db` database and `users` table on first startup

---

## Key Modules and Capabilities

### POS (Point-of-Sale) Module

- Dynamic menu grid fetched from `/api/menu` with food-item icons mapped by name
- Add/remove items to cart with quantity controls and live price updates
- Customer name and phone number input with strict validation (digits-only phone, letters-only name)
- Real-time subtotal and grand total calculation
- **Voice Recognition** — `setupVoiceRecognition()` enables hands-free order entry via browser speech API

---

### Payment System Module

| Method | Implementation |
|--------|---------------|
| Stripe Hosted Checkout | Redirects to Stripe's hosted page via `/api/stripe/checkout-session` |
| Stripe Direct Card | In-app PaymentIntent confirmation via `/api/stripe/pay-card` |
| UPI / QR Code | Displays QR, generates reference ID on confirmation |
| Digital Wallet / Net Banking | Online verification stub via `/api/payment/verify-online` |
| Cash | Direct payment record, no gateway involved |

> Stripe is **optional** — the app gracefully disables it if `STRIPE_SECRET_KEY` is missing from `.env`.

---

### Order Tracking Module

- Lists all orders with `status = 'Pending'` in chronological order (kitchen view)
- One-click **Mark as Delivered** updates status to `Delivered` and logs `delivered_at`
- API calculates and returns delivery time in seconds for performance monitoring

---

### Menu Management Module

- Full CRUD for menu items gated by Admin/Manager role
- `requireAdmin` JWT middleware enforces the role check at the API level
- Frontend calls `promptAdminAuth()` to re-verify admin credentials in the UI before destructive actions
- Non-admin staff see a locked banner with an "Unlock Admin" button

---

### Analytics and Reports Module

Powered by the `/api/stats` endpoint — aggregates 8 KPIs in a single request:

| Metric | SQL Aggregation |
|--------|----------------|
| Total Sales | `SUM(total_amount)` from Payment table |
| Total Orders | `COUNT(DISTINCT order_id)` |
| Average Order Value | `AVG(total_amount)` |
| Top 5 Menu Items | `SUM(quantity)` grouped by item, ordered DESC LIMIT 5 |
| Revenue by Payment Method | `SUM(total_amount)` grouped by `payment_method` |
| Daily Revenue Trend | `SUM(total_amount)` grouped by `DATE(order_date)` |
| Top 5 Customers | `COUNT(order_id)` per customer, ordered DESC LIMIT 5 |
| Bottom 5 Performers | Lowest unit-sold menu items via LEFT JOIN |

Rendered using **Chart.js** (CDN):
- Line Chart — Daily revenue trend
- Doughnut Chart — Revenue breakdown by payment method
- Bar Chart — Top selling items

---

### Authentication and RBAC Module

| Role | Permissions |
|------|-------------|
| Admin | Full access — add/edit/delete menu items, admin verification, all views |
| Manager | Same as Admin for menu management |
| Barista | POS and Order Tracking only |
| Cashier | POS and Order Tracking only |

- JWT tokens stored in `localStorage`
- Staff sessions expire in **1 hour**
- Admin sessions expire in **8 hours**
- Passwords hashed with `bcryptjs` at 10 salt rounds

---

## Database Schema

```sql
-- Staff accounts with role-based access
CREATE TABLE Staff (
    staff_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    email      TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,
    role       TEXT NOT NULL      -- Admin | Manager | Barista | Cashier
);

-- Walk-in or registered customers
CREATE TABLE Customer (
    customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    phone       TEXT UNIQUE NOT NULL
);

-- Cafe menu
CREATE TABLE Menu (
    item_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    item_name TEXT UNIQUE NOT NULL,
    price     REAL NOT NULL
);

-- Orders linked to customers
CREATE TABLE Orders (
    order_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id  INTEGER NOT NULL REFERENCES Customer(customer_id),
    order_date   DATETIME DEFAULT CURRENT_TIMESTAMP,
    status       TEXT DEFAULT 'Pending',   -- Pending | Delivered
    delivered_at DATETIME
);

-- Line items per order (many-to-many between Orders and Menu)
CREATE TABLE Order_Details (
    order_detail_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id        INTEGER NOT NULL REFERENCES Orders(order_id),
    item_id         INTEGER NOT NULL REFERENCES Menu(item_id),
    quantity        INTEGER NOT NULL CHECK (quantity > 0)
);

-- One payment record per order
CREATE TABLE Payment (
    payment_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id       INTEGER UNIQUE NOT NULL REFERENCES Orders(order_id),
    total_amount   REAL NOT NULL,
    payment_method TEXT NOT NULL   -- Cash | UPI | Stripe Card | etc.
);
```

> Full MySQL-compatible schema with sample data is in [cafe_management_db.sql](./cafe_management_db.sql)

---

## API Reference

### Auth Endpoints

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/api/signup` | No | Register new staff account |
| POST | `/api/login` | No | Staff login, returns JWT token |
| POST | `/api/admin/verify` | No | Re-authenticate as Admin or Manager |

### Menu Endpoints

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/api/menu` | No | Fetch all menu items |
| POST | `/api/menu` | Admin/Manager | Add a new menu item |
| PUT | `/api/menu/:id` | Admin/Manager | Update item name or price |
| DELETE | `/api/menu/:id` | Admin/Manager | Remove a menu item |

### Order Endpoints

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/api/order` | No | Place a new order with payment |
| GET | `/api/receipt/:orderId` | No | Fetch itemized order receipt |
| GET | `/api/orders/active` | No | List all pending orders |
| PUT | `/api/orders/:id/deliver` | No | Mark an order as delivered |

### Analytics Endpoints

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/api/stats` | No | All KPIs and analytics data |

### Payment Endpoints

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/api/payment/config` | No | Available payment methods |
| POST | `/api/stripe/checkout-session` | No | Create Stripe hosted checkout |
| POST | `/api/stripe/pay-card` | No | Stripe direct card PaymentIntent |
| POST | `/api/payment/verify-online` | No | Verify UPI or wallet payment |

---

## Local Development Setup

### Prerequisites

| Tool | Version | Required For |
|------|---------|--------------|
| Node.js | v18+ | Both servers |
| npm | v9+ | Both servers |
| MySQL | 8.x | server/ auth module only |

---

### Option 1 — Main App (SQLite, No Database Setup Needed)

The primary application uses SQLite. Everything is auto-created on first run.

```bash
# 1. Clone the repository
git clone https://github.com/bhupendrayv/CafeCore.git
cd CafeCore

# 2. Install backend dependencies
cd backend
npm install

# 3. Configure environment
#    Edit backend/.env and set your JWT_SECRET
#    Optionally add STRIPE_SECRET_KEY to enable Stripe payments

# 4. Start the server
npm start

# For development with auto-reload
npm run dev

# 5. Open in browser
#    http://localhost:5001
```

> The SQLite database `cafe_management.sqlite` is **auto-created** on first boot
> with seeded staff accounts and menu items. No manual SQL import needed.

---

### Option 2 — Legacy Auth Module (MySQL)

```bash
# 1. Ensure MySQL Server is running locally

# 2. Navigate and install
cd server
npm install

# 3. Edit server/.env with your MySQL credentials
#    DB_HOST=localhost
#    DB_USER=root
#    DB_PASSWORD=your_mysql_password
#    DB_NAME=cafe_db
#    JWT_SECRET=your_secret
#    PORT=5000

# 4. Start the auth server
node server.js
# The 'cafe_db' database and 'users' table are auto-created

# 5. Visit http://localhost:5000/signup
```

---

### Running Both Servers Together

```bash
# Terminal 1 — Main POS Backend (SQLite, port 5001)
cd backend
npm start

# Terminal 2 — Auth Module (MySQL, port 5000)
cd server
node server.js
```

---

## Default Credentials

These accounts are **auto-seeded** into SQLite on first boot:

| Name | Email | Password | Role |
|------|-------|----------|------|
| Admin Master | admin@aura.cafe | admin123 | Admin |
| Alice Manager | alice@aura.cafe | password123 | Manager |
| Bob Barista | bob@aura.cafe | password123 | Barista |

> **Warning:** Change all default credentials before any production deployment.

---

## Environment Variables

### backend/.env

```env
PORT=5001
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=cafe_db
JWT_SECRET=your_super_secret_key
STRIPE_SECRET_KEY=sk_test_...
```

> `STRIPE_SECRET_KEY` is optional. Remove it or leave it blank to disable Stripe.

### server/.env

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=cafe_db
JWT_SECRET=your_super_secret_key
```

---

## Project Structure

```
CafeCore/
|
+-- backend/                        Primary Express server (SQLite + Stripe)
|   +-- server.js                   All API routes — single monolith (473 lines)
|   +-- db.js                       SQLite schema definition + auto-seeding
|   +-- seed_data.sql               Additional seed data
|   +-- update_prices.js            Bulk price update utility
|   +-- cafe_management.sqlite      Auto-generated SQLite database file
|   +-- package.json
|   +-- .env
|
+-- frontend/                       Main SPA served by backend at port 5001
|   +-- index.html                  Full application shell (POS + all tabs)
|   +-- script.js                   SPA logic (~1,665 lines)
|   +-- style.css                   Custom dark-theme CSS design system
|   +-- inject_charts.js            Chart.js code injection build utility
|   +-- assets/                     Food item PNG images
|
+-- server/                         Legacy MVC auth module (MySQL, port 5000)
|   +-- server.js                   Express entry point
|   +-- config/
|   |   +-- db.js                   MySQL2 pool + auto table initialization
|   +-- routes/
|   |   +-- authRoutes.js           /api/login and /api/signup routes
|   +-- controllers/
|   |   +-- authController.js       Business logic for auth
|   +-- models/
|   |   +-- userModel.js            MySQL query abstraction
|   +-- package.json
|   +-- .env
|
+-- client/                         HTML pages served by server/ (port 5000)
|   +-- login.html
|   +-- signup.html
|   +-- style.css
|
+-- cafe_management_db.sql          MySQL schema + sample data
+-- .gitignore
+-- README.md
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 18+ |
| Web Framework | Express 4.x / 5.x |
| Primary Database | SQLite via `better-sqlite3` (WAL mode) |
| Legacy Database | MySQL 8 via `mysql2/promise` |
| Authentication | `jsonwebtoken` (JWT) + `bcryptjs` |
| Payment Gateway | Stripe SDK v22 |
| Frontend | Vanilla HTML5 + CSS3 + JavaScript (ES6+) |
| Charts | Chart.js (CDN) |
| Icons | Font Awesome (CDN) |
| Avatars | UI Avatars API |

---

Made with love for **Aura Cafe**
