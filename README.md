# SalonBook Server

REST API for **SalonBook**, a salon appointment booking platform.

## Features
- JWT verification middleware (tokens issued by Better Auth, verified via the client's JWKS endpoint)
- Server-side role checks (`admin` / `customer`) and blocked-user checks on every protected route
- Services CRUD with search, category filter and price sorting
- Appointments with slot-conflict prevention, customer cancel (pending only), admin confirm/cancel
- Stripe Checkout + **verified webhook** that marks appointments `paid` and stores transactions
- Image upload to ImgBB
- Admin: stats, users (block/unblock), read-only transactions

## Tech stack
Node.js, Express.js, MongoDB (Mongoose), jose (JWT), Stripe, Multer, ImgBB

## Installation
```bash
npm install
cp .env.example .env   # then fill in the values
```

## Run locally
```bash
npm run dev            # http://localhost:5000
npm run seed           # optional: sample services
npm run make-admin -- admin@example.com   # after that user signed up on the website
```

Stripe webhook (local):
```bash
stripe listen --forward-to localhost:5000/api/payments/webhook
# copy the printed whsec_... into STRIPE_WEBHOOK_SECRET
```

## Required environment variables (names only)
`PORT`, `NODE_ENV`, `MONGODB_URI`, `MONGODB_DB`, `CLIENT_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CURRENCY`, `IMGBB_API_KEY`

## API overview
| Method | Route | Access |
|---|---|---|
| GET | `/api/services`, `/api/services/categories`, `/api/services/:id` | Public |
| GET/POST/PUT/PATCH/DELETE | `/api/services/admin/all`, `/api/services`, `/:id`, `/:id/status` | Admin |
| GET | `/api/appointments/slots` | Logged in |
| POST/GET/PATCH | `/api/appointments`, `/my`, `/my/stats`, `/:id/cancel` | Customer |
| POST | `/api/payments/checkout` | Customer |
| POST | `/api/payments/webhook` | Stripe (signature verified) |
| GET/PATCH | `/api/users/me` | Logged in |
| * | `/api/admin/*` (stats, appointments, users, transactions) | Admin |
| POST | `/api/upload` | Public (rate-limited) |

## Links
- Live API: _add link_
- Client repo: _add link_
- Server repo: _add link_
