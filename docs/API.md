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

## 5. Ownership Claims

### `POST /api/claims`
Submit a private proof-of-ownership claim on a found item.
- **Auth Required**: Yes (`Bearer <token>`)
- **Request Body**:
```json
{
  "item_id": "d0000000-0000-0000-0000-000000000002",
  "verification_answers": {
    "answers": { "finder_question": "NASA Apollo sticker" },
    "proof_description": "Has a NASA sticker on the top right corner and a slight scratch on the base."
  }
}
```
- **Response `201 Created`**

### `PATCH /api/claims/:id/status`
Approve or reject a claim (finder only).
- **Auth Required**: Yes (`Bearer <token>`)
- **Request Body**:
```json
{
  "status": "approved",
  "finder_notes": "Answers verified. Let us meet tomorrow at Green Library lobby."
}
```
- **Response `200 OK`**

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

