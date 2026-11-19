# SalonBook - Server

Backend REST API, role verification, appointment scheduling, and Stripe Checkout + webhook payment service for **SalonBook** (Node.js, Express.js, MongoDB).

## Links
- Live server: https://salonbook-server-6wam.onrender.com
- Live client: https://salon-book-client-ruddy.vercel.app
- Client repo: https://github.com/MAIMUNA1711-a11y/SalonBook-Client
- Server repo: https://github.com/MAIMUNA1711-a11y/SalonBook-Server

## Features
- Auth/JWT and role-based access control (Admin and Customer) with blocked-user check
- Services CRUD with active/inactive toggle, search, category filter, and price sorting
- Appointments booking with duplicate date/time-slot conflict prevention
- Stripe Checkout session and verified webhook payment status + transaction history

## Tech stack
Node.js, Express.js, MongoDB, JWT / Auth Middleware, Stripe SDK & Webhooks, ImgBB, Render

## Required environment variables (names only)
PORT, NODE_ENV, CLIENT_URL, MONGODB_URI, MONGODB_DB, JWT_SECRET, BETTER_AUTH_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, IMGBB_API_KEY

## Installation
npm install
cp .env.example .env

## Run locally
npm run dev
