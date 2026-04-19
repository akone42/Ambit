# Ambit

A peer-to-peer marketplace where sellers can create storefronts and list products or services, and buyers can browse, search, and purchase from them.

Built for CISC 3140 — Web Applications, Spring 2026.

---

## Tech stack

| Layer      | Technology                                    |
| ---------- | --------------------------------------------- |
| Frontend   | React 18, Vite, Tailwind CSS, React Router v6 |
| Backend    | Node.js, Express                              |
| Database   | PostgreSQL (hosted on Neon)                   |
| Auth       | JWT in httpOnly cookies, CSRF double-submit   |
| Images     | Cloudinary                                    |
| Validation | Zod (shared between client and server)        |
| Monorepo   | npm workspaces (`client`, `server`, `shared`) |

---

## Project structure

```
Ambit/
├── client/          # React frontend (Vite)
│   └── src/
│       ├── components/   # Reusable UI components
│       ├── context/      # React Context (auth state)
│       ├── lib/          # Axios instance
│       └── pages/        # One file per route
├── server/          # Express backend
│   └── src/
│       ├── db/           # Pool, migrations, seed
│       ├── lib/          # Cloudinary helper
│       ├── middleware/   # Auth, CSRF
│       └── routes/       # One file per resource
└── shared/          # Zod schemas used by both client and server
```

---

## Prerequisites

Before running this project you need:

- **Node.js v18+** — download from [nodejs.org](https://nodejs.org)
- **npm v9+** — comes with Node.js
- A **Neon** PostgreSQL database — [neon.tech](https://neon.tech) (free tier works)
- A **Cloudinary** account — [cloudinary.com](https://cloudinary.com) (free tier works)

---

## Getting started 

### 1. Clone the repo

```bash
git clone https://github.com/akone42/Ambit.git
cd Ambit
```

### 2. Install all dependencies

This installs packages for all three workspaces (client, server, shared) in one command:

```bash
npm install
```

### 3. Create the server environment file

The server needs secret credentials that are **not** stored in git (for security). You need to create the file yourself.

```bash
cp server/.env.example server/.env
```

Then open `server/.env` and fill in your own values:

```
PORT=3001
CLIENT_URL=http://localhost:5173

# Your Neon database connection string
# Found in: Neon dashboard → your project → Connection string
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# A long random string used to sign JWT tokens — make up anything, keep it secret
JWT_SECRET=replace_this_with_a_long_random_string

# Your Cloudinary credentials
# Found in: Cloudinary dashboard → Settings → API Keys
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

> **Never commit your `.env` file.** It's listed in `.gitignore` so git will ignore it automatically.

### 4. Set up the database

This creates all the tables in your Neon database:

```bash
npm run migrate --workspace=@ambit/server
```

You should see: `✓ Migration complete` in the terminal.

### 5. (Optional) Seed the database with sample data

This fills the database with 10 users, 5 storefronts, 20 listings, 8 orders, and reviews so you have something to look at right away:

```bash
npm run seed --workspace=@ambit/server
```

Seller accounts added by the seed (all use password `password123`):
| Email | Username | Storefront |
|---|---|---|
| alice@example.com | alicemaker | alice-handmade |
| bob@example.com | bobcraft | bobcraft-studio |
| carla@example.com | carladesign | carla-design |
| dani@example.com | danibakes | danis-bakery |
| eve@example.com | eveteach | eves-tutoring |

### 6. Start the development servers

This starts both the frontend (port 5173) and backend (port 3001) at the same time:

```bash
npm run dev
```

Then open your browser to: **http://localhost:5173**

---

## Running servers individually

If you only need one server (e.g. you're working on just the frontend):

```bash
# Frontend only
npm run dev --workspace=@ambit/client

# Backend only
npm run dev --workspace=@ambit/server
```

---

## Other useful commands

```bash
# Run the linter across the whole repo
npm run lint

# Auto-format all files with Prettier
npm run format

# Re-run the database migration (safe to run multiple times — uses IF NOT EXISTS)
npm run migrate --workspace=@ambit/server

# Wipe and re-seed the database (WARNING: deletes all existing data)
npm run seed --workspace=@ambit/server
```

---

## Environment variables reference

| Variable                | Where to get it                              | Required |
| ----------------------- | -------------------------------------------- | -------- |
| `PORT`                  | Set to `3001`                                | Yes      |
| `CLIENT_URL`            | Set to `http://localhost:5173` for local dev | Yes      |
| `DATABASE_URL`          | Neon dashboard → Connection string           | Yes      |
| `JWT_SECRET`            | Make up any long random string               | Yes      |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary dashboard → Settings              | Yes      |
| `CLOUDINARY_API_KEY`    | Cloudinary dashboard → Settings              | Yes      |
| `CLOUDINARY_API_SECRET` | Cloudinary dashboard → Settings              | Yes      |

---

## API routes

### Auth — `/api/auth`

| Method | Path        | Access | Description      |
| ------ | ----------- | ------ | ---------------- |
| POST   | `/register` | Public | Create account   |
| POST   | `/login`    | Public | Log in           |
| POST   | `/logout`   | Auth   | Log out          |
| GET    | `/me`       | Auth   | Get current user |
| PUT    | `/me`       | Auth   | Update profile   |

### Storefronts — `/api/storefronts`

| Method | Path          | Access | Description            |
| ------ | ------------- | ------ | ---------------------- |
| POST   | `/`           | Seller | Create storefront      |
| GET    | `/my`         | Seller | Get own storefront     |
| GET    | `/slug/:slug` | Public | Get storefront by slug |
| PUT    | `/:id`        | Owner  | Update storefront      |

### Listings — `/api/listings`

| Method | Path   | Access | Description                            |
| ------ | ------ | ------ | -------------------------------------- |
| POST   | `/`    | Seller | Create listing                         |
| GET    | `/`    | Public | Browse (supports `?search=&category=`) |
| GET    | `/:id` | Public | Get one listing                        |
| PUT    | `/:id` | Owner  | Update listing                         |
| DELETE | `/:id` | Owner  | Soft-delete listing                    |

### Upload — `/api/upload`

| Method | Path | Access | Description                             |
| ------ | ---- | ------ | --------------------------------------- |
| POST   | `/`  | Auth   | Upload image to Cloudinary, returns URL |

---

## How the monorepo works

This repo uses **npm workspaces** — one `npm install` at the root installs all packages for all three sub-projects and links them together.

The `shared` package (`@ambit/shared`) contains Zod validation schemas that are imported by both the server and the client. This guarantees the same validation rules run in both places — if the server says an email must be valid, the client form says the same thing, using the exact same code.
