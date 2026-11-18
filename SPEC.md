# Global Lost and Found Platform (FindIt / ReUnite) - Full Specification

## 1. Overview & Vision
A public, responsive, production-quality Lost and Found web application designed for global usage (any location worldwide) with an additional Campus Navigation mode. The platform enables users to report lost and found items, search listings with granular filters, receive automated matching recommendations, safely communicate with reporters, process claim ownership verifications, and coordinate returns without compromising privacy or sharing direct contact details publicly.

---

## 2. Technical Stack
- **Frontend**: React 18, Vite 5, TypeScript, Tailwind CSS, Lucide React, React Router v6, React Hook Form + Zod, TanStack Query v5, Leaflet + OpenStreetMap.
- **Backend**: Node.js v20.18, Express, TypeScript, Zod, Helmet, CORS, Express Rate Limit, Multer (memory/temp storage).
- **Database / Auth / Storage**: Supabase (Postgres with Row-Level Security, Supabase Auth with JWT, Supabase Storage for item images).
- **Testing**: Vitest + React Testing Library (frontend), Vitest + Supertest (backend).
- **External Public APIs**:
  - OpenStreetMap Nominatim for geocoding and reverse geocoding (polite usage: debounced, user-agent set, in-memory cache).
  - Open Source Routing Machine (OSRM) for walking directions in Campus mode.

---

## 3. Design System & UX Standards
- **Theme**: Light, trustworthy, startup-grade UI. Clean white and light-gray surfaces (`#F8FAFC`, `#FFFFFF`), blue (`#2563EB`) and teal (`#0D9488`) brand accents, subtle slate borders and drop shadows (`shadow-sm`, `shadow-md`), rounded corners (`rounded-xl`, `rounded-2xl`).
- **Typography**: Inter / System sans-serif with accessible contrast ratios (WCAG AA compliant).
- **Responsive & Mobile-first**: Full responsiveness across 320px mobile screens to wide desktop monitors.
- **State Handling**: Every view includes loading skeletons, empty state illustrations with helpful call-to-actions, and error boundaries with recovery buttons.
- **Dark Mode**: Accessible dark mode toggle with slate dark surfaces.

---

## 4. Page-by-Page Specifications

### 4.1 Home Page (`/`)
- **Hero Section**:
  - Headline: "Lost Something? Let's Find It."
  - Subtitle: "The trusted global network reconnecting people with their lost belongings across cities and campuses worldwide."
  - Primary CTAs: "Report Lost Item" (Red/Rose accent) & "Report Found Item" (Teal/Emerald accent).
  - Quick Search Bar: Keyword input, Category dropdown, City/Location input, Search button directing to `/browse`.
- **Live Platform Stats**: Database-backed metrics (e.g., Total Items Reported, Items Reunited, Active Searches, Return Rate %). Never hardcoded; falls back gracefully if unconfigured.
- **Recent Items Carousel / Grid**: Newest 6-8 verified lost and found listings with status badges, thumbnail, relative time ("2 hours ago"), and city/landmark.
- **Browse Categories**: Grid of 10+ category tiles with icons and item counts.
- **How It Works**: 3-step visual guide:
  1. *Report*: Provide item details, upload photos, and pin an approximate location.
  2. *Match & Chat*: Our transparent matching engine notifies you when a potential match is found. Communicate safely via secure in-app messaging.
  3. *Verify & Reunited*: Complete private verification questions and arrange a safe public return.
- **Campus Mode Banner**: Quick teaser linking to `/campus` for college students, transit hubs, and corporate parks.
- **Footer**: Brand logo, mission statement, navigation links (About, Contact, Privacy, Terms, Help & Safety Tips), copyright notice.

### 4.2 Browse & Search Page (`/browse`)
- **Search & Filters Header**:
  - Free-text search input with instant debounce.
  - Type toggle: All, Lost Only, Found Only.
  - Category filter dropdown.
  - Location filter: Country, State, City, Landmark.
  - Date Range filter: Today, Past 7 days, Past 30 days, Custom range.
  - Radius filter (when coordinates exist): 1km, 5km, 25km, 50km.
  - Sort by: Newest First, Oldest First, Proximity (if location entered).
- **Listing Grid**:
  - Responsive cards with item image preview (or category fallback icon).
  - Type badge ("Lost" or "Found"), Category badge, Location (City, Country), Date.
  - Relative time stamp and current status ("Open", "Pending Claim", "Returned").
- **Pagination**: Page numbers with Previous/Next controls, total count indicator.
- **Empty State**: Friendly "No items found matching your criteria" with clear filter button.

### 4.3 Report Lost & Report Found Pages (`/report/lost` and `/report/found`)
- **Multi-Step / Form Layout**:
  - **Step 1: Item Details**: Title (min 5 chars), Category, Brand, Model, Primary Color, Secondary Color, Distinguishing Features, Serial Number / Unique identifier (stored securely, not displayed publicly on found items).
  - **Step 2: Date & Location**: Date occurred, Country, State, City, Landmark/Neighborhood, Manual coordinate entry or interactive Leaflet map pin picker.
  - **Step 3: Photos**: Drag-and-drop file upload with preview, file type validation (PNG, JPG, WEBP), max 5MB per image, max 5 images.
  - **Step 4: Contact & Verification**: Contact preference (In-App Messaging, Email, Phone), private secret verification question (e.g., "What sticker is on the back?").
- **Privacy Warning Banner (Crucial on Found Form)**:
  - Warning alert: *"For user safety, do NOT post full credit card numbers, government IDs, passport numbers, or exact private residential addresses. Describe items generally."*

### 4.4 Item Details Page (`/items/:id`)
- **Photo Gallery**: Main photo viewer with thumbnail strip and lightbox zoom.
- **Public Item Information**:
  - Title, Type ("Lost" or "Found"), Category, Status badge.
  - Date occurred and relative time.
  - Approximate location (City, State, Country, Landmark) and Leaflet map view (no exact private home address).
  - Description and non-sensitive attributes (color, brand).
- **Actions Bar**:
  - For Found Items: "I Think This Is Mine" (opens Claim Verification modal).
  - "Contact Reporter" (starts or opens secure in-app conversation).
  - "Share Listing" (copies link).
  - "Save to My Favorites".
  - "Report This Listing" (flag for moderation).
- **Strict Privacy**: Reporter email and phone number are NEVER rendered in the HTML/DOM.

### 4.5 Claims Workflow (`/claims/:id` & In-Modal)
- **Claim Submission**: Claimant submits proof of ownership and answers finder's verification prompt.
- **Claim Review (Finder's View)**:
  - Finder reviews claimant's private verification answers.
  - Actions: "Approve Claim" or "Reject Claim" (with optional explanation).
- **Safe Return Coordination**:
  - Once approved, status moves to `pending_claim` and both parties receive a Safe Return Checklist:
    - Meet only in well-lit, public locations (e.g., police station lobby, university student union, coffee shop).
    - Bring a friend if possible.
    - Inspect the item before finalizing.
- **Mark Returned**: Either party can confirm completion, marking item as `returned`.

### 4.6 Matching Engine (`/dashboard?tab=matches`)
- Automatic rule-based matching triggered when any lost or found item is created.
- Computes weighted score (0-100) across 5 dimensions:
  1. Category Match (25%)
  2. Text & Title Similarity (30%)
  3. Geo Proximity (Haversine formula) (25%)
  4. Date Proximity (15%)
  5. Attribute Overlap (5%)
- Scores stored in `matches.score_breakdown`.
- Displays High (≥75%), Medium (55-74%), or Low (45-54%) match cards with detailed factor breakdown and "View Item" / "Dismiss" buttons.

### 4.7 Secure In-App Messaging (`/messages`)
- Split-screen layout: Conversation list on left, active chat on right.
- Item context header in chat showing thumbnail, title, and status.
- Real-time/polled messaging with timestamp, sender avatar, and read status badges.
- Privacy & safety controls: "Block User" and "Report User" actions in conversation menu.
- Access restricted strictly to conversation participants.

### 4.8 User Dashboard (`/dashboard`)
- Summary cards: My Lost Reports, My Found Reports, Potential Matches, Active Claims, Unread Messages.
- Tabbed view:
  - **My Lost Reports**: List with Edit, Mark as Resolved, Delete options.
  - **My Found Reports**: List with Edit, Review Claims, Mark as Returned, Delete options.
  - **Matches**: List of match suggestions with score cards.
  - **Claims**: Claims made by me and claims received for my items.
  - **Saved Listings**: Bookmarked items for quick tracking.
  - **Settings**: Profile information (Name, Avatar, Contact Preferences, Notification Toggles).

### 4.9 Admin & Moderation Panel (`/admin`)
- Accessible only to users with `role === 'admin'`. Enforced via Express middleware and Postgres RLS.
- **Analytics Overview**: Total users, total items, active vs resolved count, pending claims, reported listings.
- **Moderation Queue**: List of flagged listings from `abuse_reports` table with status ('pending', 'reviewed', 'actioned', 'dismissed'). Actions: Approve listing, Hide listing, Delete listing.
- **User Management**: Search users, toggle ban status with reason logging.
- **System Health**: Database connectivity status, storage bucket status.

### 4.10 Campus Navigation Mode (`/campus`)
- Campus Selector: Select from seeded campuses (e.g., Stanford University, MIT, Central City University).
- Interactive Campus Map:
  - Custom SVG markers for campus buildings, dining halls, libraries, student unions, and lost/found items.
  - Building search input with auto-pan and zoom.
- Walking Directions:
  - Select "Directions to Item Location" or between two buildings.
  - Calls OSRM walking profile (`/route/v1/walking/{lng1},{lat1};{lng2},{lat2}`) with fallback to straight-line distance and compass bearing.
  - Renders polyline walking route on Leaflet map with distance and estimated walking time.

---

## 5. Security & Privacy Blueprint
1. **Server Validation**: All endpoints protected with Zod validation schemas.
2. **Rate Limiting**:
   - Auth endpoints: 10 requests / 15 minutes.
   - API endpoints: 100 requests / 15 minutes.
   - Search endpoints: 60 requests / minute.
3. **Storage Security**: Public images stored in `item-images` bucket; file type whitelist (`image/jpeg`, `image/png`, `image/webp`), max 5MB.
4. **Authorization Checks**: Users can only update/delete items they own; claims verification answers only readable by claimant and finder; admin endpoints verify JWT role from DB.

