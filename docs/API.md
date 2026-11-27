# FindIt REST API Documentation

Base URL: `http://localhost:3001` (Dev) or `https://your-api.onrender.com` (Prod)  
Frontend Client Proxy: `/api` -> `http://localhost:3001/api`

---

## 1. Authentication & Security Headers

All protected endpoints require a Supabase JWT access token in the `Authorization` header:

```http
Authorization: Bearer <supabase_access_token>
```

### Rate Limiting
- **General API endpoints**: 200 requests / 15 minutes (`ratelimit-limit: 200`)
- **Search endpoints**: 60 requests / 1 minute
- **Sensitive actions (Claims & Reports)**: 30 requests / 15 minutes

---

## 2. Health & Statistics

### `GET /api/health`
Returns system status and Supabase configuration state.
- **Response `200 OK`**:
```json
{
  "status": "ok",
  "timestamp": "2026-11-18T22:00:00.000Z",
  "supabaseConfigured": true
}
```

### `GET /api/stats`
Returns live platform metrics aggregated directly from the database.
- **Response `200 OK`**:
```json
{
  "totalReported": 124,
  "itemsReturned": 42,
  "activeMatches": 89,
  "returnRate": 34
}
```

---

## 3. Items & Listings

### `GET /api/items`
Browse and search items with multi-parameter filtering.
- **Query Parameters**:
  - `q` (string, optional): Search keyword matching title or description.
  - `type` (`'all' | 'lost' | 'found'`, optional, default: `'all'`)
  - `category` (UUID, optional)
  - `location` (string, optional): City, state, or country name.
  - `dateRange` (`'all' | 'today' | '7d' | '30d'`, optional)
  - `sort` (`'newest' | 'oldest'`, optional, default: `'newest'`)
  - `page` (number, default: `1`)
  - `limit` (number, default: `12`)
- **Response `200 OK`**:
```json
{
  "items": [
    {
      "id": "d0000000-0000-0000-0000-000000000001",
      "user_id": "a0000000-0000-0000-0000-000000000001",
      "type": "lost",
      "title": "Space Gray MacBook Pro 14\"",
      "description": "Left on 2nd floor of Green Library",
      "status": "open",
      "location_city": "Stanford",
      "location_country": "United States",
      "latitude": 37.4276,
      "longitude": -122.1668,
      "date_occurred": "2026-11-10",
      "primary_image_url": "https://...",
      "created_at": "2026-11-10T12:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 12,
  "totalPages": 1
}
```

### `GET /api/items/:id`
Fetch single listing details with attached gallery images and anonymized reporter info.
- **Response `200 OK`**:
```json
{
  "item": { ... },
  "images": [
    {
      "id": "...",
      "public_url": "https://..."
    }
  ]
}
```

### `POST /api/items`
Submit a new lost or found report. Automatically triggers matching engine.
- **Auth Required**: Yes (`Bearer <token>`)
- **Request Body**:
```json
{
  "type": "lost",
  "title": "Black Leather Fossil Wallet",
  "description": "Lost near student union containing bus pass",
  "category_id": "a0000000-...",
  "date_occurred": "2026-11-18",
  "location_country": "United States",
  "location_city": "Stanford",
  "location_landmark": "Tresidder Student Union",
  "latitude": 37.4241,
  "longitude": -122.1706,
  "primary_image_url": "https://...",
  "attributes": {
    "brand": "Fossil",
    "color": "Black"
  }
}
```
- **Response `201 Created`**:
```json
{
  "item": { "id": "...", "title": "..." }
}
```

### `DELETE /api/items/:id`
Deletes an item listing. Authorized only for item owner or platform administrators.
- **Auth Required**: Yes (`Bearer <token>`)
- **Response `200 OK`**:
```json
{ "success": true, "message": "Item listing deleted successfully" }
```

---

## 4. Matching Engine

### `POST /api/matches/compute/:itemId`
Executes weighted rule-based scorer for the item against active opposite candidates.
- **Response `200 OK`**:
```json
{
  "success": true,
  "matchesFound": 2
}
```

### `GET /api/matches`
Lists all candidate matches for items owned by the authenticated caller.
- **Auth Required**: Yes (`Bearer <token>`)
- **Response `200 OK`**:
```json
{
  "matches": [
    {
      "id": "...",
      "score": 87.5,
      "score_breakdown": {
        "text_similarity": { "weight": 30, "score": 0.85, "explanation": "..." },
        "category": { "weight": 25, "score": 1.0, "explanation": "..." },
        "distance": { "weight": 25, "score": 1.0, "explanation": "..." },
        "date_proximity": { "weight": 15, "score": 0.9, "explanation": "..." },
        "attributes": { "weight": 5, "score": 1.0, "explanation": "..." }
      },
      "lost_item": { ... },
      "found_item": { ... }
    }
  ]
}
```

---

## 5. Ownership Claims & Verification Hardening

### `POST /api/claims`
Submit a private proof-of-ownership claim on a found item.
- **Auth Required**: Yes (`Bearer <token>`)
- **Guards & Anti-Fraud Enforcements**:
  - Max 1 active claim per item.
  - Max 2 attempts per user per item with a mandatory 24-hour cooldown after rejection.
  - Daily/weekly limits (max 3 rejections/24h, 10/week) trigger automatic temporary lock (`user_claim_locks`).
  - Fresh accounts (<24h old) restricted from claiming high-value categories (phones, laptops, wallets, jewellery).
  - PII redaction scanner automatically masks sensitive numbers.
  - Evaluates deterministic verification match engine and flags suspicious patterns for admin review.
- **Request Body**:
```json
{
  "item_id": "d0000000-0000-0000-0000-000000000002",
  "verification_answers": {
    "answers": {
      "marks": "Scratch near bottom right USB-C port",
      "category_detail": "Golden retriever puppy wallpaper"
    },
    "proof_description": "Purchased at campus store last semester."
  },
  "proof_files": [
    {
      "name": "receipt.pdf",
      "url": "https://...",
      "size": 184000,
      "file_type": "application/pdf"
    }
  ]
}
```
- **Response `201 Created`**:
```json
{
  "claim": {
    "id": "c0000000-...",
    "status": "pending",
    "item_id": "...",
    "created_at": "..."
  }
}
```
*(Notice: `match_explanation` and `item_private_details` are strictly excluded from the claimant response).*

### `GET /api/claims`
List claims submitted by the authenticated user, or claims received on items found by the authenticated user.
- **Auth Required**: Yes (`Bearer <token>`)

### `GET /api/claims/item/:itemId`
Side-by-side claim review for the item finder or platform admin.
- **Auth Required**: Yes (`Bearer <token>`, finder or admin only)
- **Response `200 OK`**: Returns claimant's answers, proof files, claimant profile aggregate (account age, return history), finder's hidden proof details (`item_private_details`), and the `match_score` / `match_explanation`.

### `PATCH /api/claims/:id/status`
Approve or reject a claim (finder or admin only).
- **Behavior**: Approving a claim automatically transitions other competing pending claims on the same item to `'on_hold'`. Rejection reasons remain completely neutral to prevent leaking verification secrets.
- **Auth Required**: Yes (`Bearer <token>`)

### `POST /api/claims/:id/handover-confirm`
Mutual safe handover confirmation.
- **Behavior**: Records individual confirmation (`finder_confirmed_handover` or `claimant_confirmed_handover`). Item transitions to `'returned'` only when **both** parties confirm.
- **Auth Required**: Yes (`Bearer <token>`, claim participant only)

### `POST /api/claims/:id/dispute`
Flag an active claim with a dispute.
- **Behavior**: Freezes claim and item status to `'disputed'` and notifies platform moderators.
- **Auth Required**: Yes (`Bearer <token>`, claim participant only)

### `POST /api/claims/:id/report-suspicious`
Finder flags an incoming claim as suspicious.
- **Auth Required**: Yes (`Bearer <token>`, finder only)

---

## 5.1 Item Private Proof Details (Finder Only)

### `GET /api/items/:id/private-details`
Retrieve secret proof details.
- **Auth Required**: Yes (item finder or admin only)

### `POST /api/items/:id/private-details`
Register 1 to 3 secret proof details for a found item report.
- **Auth Required**: Yes (item finder only)
- **Request Body**:
```json
{
  "details": [
    {
      "detail_type": "lock_screen",
      "detail_label": "Lock screen wallpaper",
      "detail_value": "Golden retriever puppy on green grass"
    },
    {
      "detail_type": "scratch_mark",
      "detail_label": "Scratch location",
      "detail_value": "Small scratch near bottom right USB-C charging port"
    }
  ]
}
```

---

## 5.2 Admin Actions & Immutable Audit Log

### `POST /api/admin/actions`
Execute moderation action on a user or claim.
- **Auth Required**: Yes (`role === 'admin'`)
- **Actions**: `'warn_user'`, `'lock_claims'`, `'suspend_user'`, `'dismiss_flag'`, `'resolve_dispute'`.
- **Behavior**: Automatically appends an immutable entry to `admin_audit_logs`.

### `GET /api/admin/audit-logs`
Retrieve audit trail logs.
- **Auth Required**: Yes (`role === 'admin'`)

---

## 5.3 Data Retention & Scheduled Anonymization Routine

Sensitive verification answers and proof document attachments are retained for 90 days after an item is closed (`'returned'` or `'cancelled'`).

### Automated Database Routine (`cleanup_expired_claims()`)
```sql
-- Run daily cleanup using pg_cron (Supabase Dashboard -> SQL Editor)
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
    'daily-claims-retention-cleanup',
    '0 3 * * *',
    'SELECT public.cleanup_expired_claims();'
);
```

---

## 6. Secure Messaging

### `GET /api/messages/conversations`
List all active conversations for the authenticated user.
- **Auth Required**: Yes

### `GET /api/messages/:conversationId`
Retrieve chat history for a conversation. Automatically marks messages as read.
- **Auth Required**: Yes (Must be participant in conversation)

### `POST /api/messages`
Send message inside conversation.
- **Auth Required**: Yes
- **Request Body**:
```json
{
  "conversation_id": "...",
  "content": "Hello, I submitted a claim for this item."
}
```

---

## 7. Administrative Console

All routes in `/api/admin` require a verified user with `role === 'admin'`. Non-admins receive `403 Forbidden`.

### `GET /api/admin/overview`
Platform analytics.

### `GET /api/admin/reports`
Moderation queue of user abuse reports.

### `PATCH /api/admin/reports/:id`
Update moderation status (`'reviewed'`, `'actioned'`, `'dismissed'`).

### `PATCH /api/admin/users/:id/ban`
Suspend or reinstate a user account: `{ "is_banned": true }`.

### `DELETE /api/admin/items/:id`
Administrative removal of an infringing listing.

---

## 8. Campus Mode

### `GET /api/campus/places`
List seeded campus hubs (Stanford, MIT, Oxford).

### `GET /api/campus/places/:id/buildings`
List buildings, landmarks, codes, and coordinates for a selected campus.

---

## 9. Community, Notifications & Advanced Features

### `GET /api/community/live-activity`
Returns real-time aggregated metrics directly from database counts:
- **Response `200 OK`**:
```json
{
  "reportedToday": 14,
  "reunitedThisWeek": 8,
  "activeReports": 45,
  "timestamp": "2026-11-27T10:00:00.000Z"
}
```

### `GET /api/community/stories`
Fetch published community success stories.
- **Privacy & Dual Opt-in Guarantee**: Stories are returned **only** when both `finder_opt_in === true` AND `claimant_opt_in === true`, and `is_moderator_removed === false`.
- **Response `200 OK`**:
```json
{
  "stories": [
    {
      "id": "...",
      "item_id": "...",
      "story_text": "Thank you so much for finding my MacBook at the library!",
      "finder_name": "Alex K.",
      "claimant_name": "Sarah M.",
      "created_at": "..."
    }
  ]
}
```

### `POST /api/community/stories/:itemId/opt-in`
Allows a finder or claimant of a successfully returned item to opt in and submit a thank-you message.
- **Auth Required**: Yes
- **Body**: `{ "thank_you_note": "Thank you for safely returning my wallet!" }`

### `GET /api/community/leaderboard`
Returns the top finders of the current month.
- **Privacy Opt-In Invariant**: Only includes profiles where `leaderboard_opt_in === true` (or unset default true; users who opted out with `false` are completely omitted).

### `GET /api/community/smart-suggestions`
Returns personalized smart suggestions for the user's dashboard:
1. `nearLostReports`: Open found items reported in the same cities or categories as the user's open lost reports.
2. `helpCandidates`: Recently reported open lost items in the user's general area.
- **Auth Required**: Yes

### `POST /api/community/digest-preferences`
Updates the user's quiet hours and digest preferences in their profile:
- **Auth Required**: Yes
- **Body**:
```json
{
  "weekly_digest_enabled": true,
  "quiet_hours_enabled": true,
  "quiet_hours_start": "22:00",
  "quiet_hours_end": "08:00",
  "leaderboard_opt_in": true
}
```


