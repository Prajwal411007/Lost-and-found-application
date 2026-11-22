# FindIt - Global Lost & Found Platform

A production-grade, responsive, and privacy-preserving web platform for reporting, searching, matching, and recovering lost belongings worldwide, featuring an interactive Campus Navigation mode with walking directions.

---

## 1. Features Delivered

1. **Authentication & Authorization**:
   - Supabase Auth integration: Sign up, Log in, Logout, Email verification notice, Forgot password, Reset password.
   - Profile management: Edit display name, avatar, private phone number, and contact preferences.
   - Route protection: `ProtectedRoute` and `AdminRoute` with 403 Forbidden lockout.
   - Graceful Configuration Fallback: Renders a clean "Configuration Required" screen if Supabase keys are not yet provided.
2. **Global Listings & Search**:
   - Multi-step report wizard for lost and found items.
   - Image upload with client-side file type and 5MB size limit validation.
   - Interactive Leaflet map pin picker with automatic reverse geocoding via OpenStreetMap Nominatim.
   - Mandatory privacy warning on found forms prohibiting government IDs, credit card numbers, or exact residential addresses.
   - Granular browse filters: Keyword search, category, type (lost/found), country/state/city, date range, and pagination.
3. **Transparent Weighted Matching Engine**:
   - Modular architecture behind `MatchStrategy` interface.
   - Weighted scoring dimensions:
     - Text similarity (30%)
     - Category taxonomy match (25%)
     - Geographic proximity using Haversine formula (25%)
     - Date proximity (15%)
     - Attributes match (5%)
   - Full factor breakdown stored in `matches.score_breakdown` with High, Medium, and Low tiers.
   - Triggers on item creation and alerts both parties.
4. **Claims & Safe Return Coordination**:
   - Private ownership claim submission with secret verification answers.
   - Finder reviews verification answers privately with approve/reject decisions.
   - Safe Return Checklist emphasizing public daytime meeting spots and verification checks.
   - "Mark as Returned" flow updating platform resolution stats.
5. **Secure In-App Messaging**:
   - Real-time/polled messaging between verified participants only.
   - Item badge context in active chat, unread count badges, block and report user safety actions.
   - Zero public PII: Phone numbers and emails are never exposed.
6. **Campus Navigation Mode**:
   - Pre-seeded campus hubs (Stanford, MIT, Oxford).
   - Interactive Leaflet map with custom SVG markers for campus buildings, dining commons, libraries, and lost/found items.
   - Building directory search with auto-pan and zoom.
   - Walking directions via Open Source Routing Machine (OSRM) with step-by-step guidance and offline fallback.
7. **Administrative Console & Moderation**:
   - Real database analytics: Total users, items, returned counts, pending claims, and abuse reports.
   - Moderation queue for reviewing flagged listings with dismiss and administrative removal actions.
   - User account suspension (ban/unban) with reason audit logging.
   - Dual security enforcement: Admin checks enforced in Express middleware and Postgres RLS.

---

## 2. Tech Stack

- **Frontend**: React 18, Vite 5, TypeScript, Tailwind CSS, Lucide React, React Router v6, React Hook Form + Zod, TanStack Query v5, Leaflet.
- **Backend**: Node.js v20.18, Express, TypeScript, Helmet, CORS, Express Rate Limit, Zod validation.
- **Data & Auth**: Supabase (PostgreSQL, Row-Level Security, Auth, Storage bucket `'item-images'`).
- **Testing**: Vitest, React Testing Library, Supertest (26/26 automated tests passing across 5 suites).

---

## 3. Assumptions & Decisions

1. **Database Migrations via Dashboard**: In accordance with user settings, no Supabase CLI is required. All database schemas are formatted into standard SQL files (`supabase/migrations/001_init.sql`, `002_campus_places.sql`, and `seed.sql`) ready to execute in the Supabase Dashboard SQL Editor.
2. **Missing Keys Fallback**: When `.env` is unconfigured or Supabase keys are missing, the UI presents a helpful **Configuration Required** screen detailing the exact variables needed.
3. **Nominatim & OSRM Polite Usage**: Geocoding and routing requests include custom `User-Agent` headers (`FindIt-GlobalLostAndFoundPlatform/1.0`), client debouncing (400ms), and in-memory LRU caching to respect open-source public API policies. If OSRM is busy or unreachable, the system automatically falls back to straight-line distance and compass bearing guidance.
4. **Email Notifications**: Optional via Resend. If `RESEND_API_KEY` is omitted, email dispatch is skipped silently while keeping in-app notifications fully operational.

---

## 4. Local Setup Guide

### Prerequisites
- Node.js v20.18.0 or higher
- npm v10.8+

### Step 1: Clone and Install
```bash
npm install
```

### Step 2: Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your Supabase credentials:
```env
# Client-accessible keys
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Server-only secret key (Backend)
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# URLs
PORT=3001
FRONTEND_URL=http://localhost:5173
```

### Step 3: Run Database Migrations in Supabase Dashboard
Go to your Supabase project's **SQL Editor** and run the files in the following order:
1. `supabase/migrations/001_init.sql`: Core schema, enums, tables, RLS policies, storage bucket, triggers, and category seed.
2. `supabase/migrations/002_campus_places.sql`: Campus places and building landmarks schema and seeds.
3. `supabase/seed.sql` (Optional Demo Data): Creates test users in `auth.users`, profiles, sample items, realistic matches, and claims.

> [!CAUTION]
> **DEMO ONLY — NEVER RUN SEED AGAINST PRODUCTION**  
> `supabase/seed.sql` is strictly intended for local development and test environments. It creates pre-seeded accounts with fixed UUIDs and well-known passwords. **Never run `seed.sql` against a production database.**

#### Pre-Configured Demo Accounts (Development Only)
When `supabase/seed.sql` is executed, the following demo accounts are created and pre-confirmed for immediate login:

| Email | Password | Role | Permissions / Purpose |
| :--- | :--- | :--- | :--- |
| `admin@lostandfound.local` | `AdminDemo123!` | `admin` | Full admin privileges (`/admin` console, moderation queue, user management) |
| `alex.reporter@example.com` | `AlexDemo123!` | `user` | Reporter demo user (owns lost MacBook report & brown wallet report) |
| `sarah.finder@example.com` | `SarahDemo123!` | `user` | Finder demo user (owns found MacBook report & car key fob report) |

### Step 4: Run Development Servers
Start both the Vite frontend (`http://localhost:5173`) and Express API backend (`http://localhost:3001`):
```bash
npm run dev
```

Or start them individually:
```bash
npm run dev:client  # Vite dev server on port 5173
npm run dev:server  # Express API on port 3001
```

### Step 5: Run Automated Tests
```bash
npm test
```

---

## 5. Deployment Guide

### Frontend Deployment on Vercel
1. Link your repository to Vercel.
2. **Framework Preset**: Vite
3. **Build Command**: `npm run build:client`
4. **Output Directory**: `dist`
5. **Environment Variables**:
   - `VITE_SUPABASE_URL`: Your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Public Anon Key
6. Configure rewrites in `vercel.json` for single-page routing:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Backend Deployment on Render
1. Create a new **Web Service** pointing to the repository.
2. **Runtime**: Node
3. **Build Command**: `npm install && npm run build:server`
4. **Start Command**: `npm start`
5. **Environment Variables**:
   - `NODE_ENV`: `production`
   - `PORT`: `3001`
   - `SUPABASE_URL`: Your Supabase Project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role Secret Key
   - `FRONTEND_URL`: URL of your deployed Vercel frontend (e.g. `https://findit.vercel.app`)
   - `RESEND_API_KEY`: (Optional) For transactional email alerts

### CORS & Supabase Redirect Checklist
- [ ] Add your production frontend URL to the CORS allowed origins in `server/app.ts` / `FRONTEND_URL`.
- [ ] In the Supabase Dashboard (**Authentication -> URL Configuration**):
  - Add your production frontend URL to **Site URL**.
  - Add `https://<your-vercel-domain>/reset-password` and `https://<your-vercel-domain>/login` to **Redirect URLs**.

# Lost-and-found-application
