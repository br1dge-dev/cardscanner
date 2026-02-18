# DotGG Collection API - Third-Party Integration Guide

**Base URL:** `https://api.dotgg.gg`

This guide is for developers building external tools that interact with DotGG collection data using their WordPress account credentials.

---

## Authentication

### Step 1: Obtain API Token

Exchange your email and password for an API token. This only needs to be done once - tokens do not expire.

**Endpoint:** `POST /email-auth-mobile.php`

**Request:**

```bash
curl -X POST https://api.dotgg.gg/email-auth-mobile.php \
  -d "email=your@email.com" \
  -d "password=yourpassword"
```

**Success Response:**

```json
{
  "DotGGUser": 12345,
  "DotGGUserToken": "abc123def456"
}
```

**Error Response:**

```json
{
  "error": "Invalid email or password"
}
```

**Store these credentials** - you'll use them for all authenticated API requests.

### Step 2: Use Token in API Requests

Include the `Dotgguserauth` header in all authenticated requests:

```
Dotgguserauth: {DotGGUser}:{DotGGUserToken}
```

**Example:**

```bash
curl -X GET "https://api.dotgg.gg/cgfw/getuserdata?game=lorcana" \
  -H "Dotgguserauth: 12345:abc123def456"
```

---

## Quick Start Example (Python)

```python
import requests

API_BASE = "https://api.dotgg.gg"

# Step 1: Get token (do this once, save credentials)
auth_response = requests.post(f"{API_BASE}/email-auth-mobile.php", data={
    "email": "your@email.com",
    "password": "yourpassword"
})
creds = auth_response.json()

if "error" in creds:
    raise Exception(creds["error"])

USER_ID = creds["DotGGUser"]
TOKEN = creds["DotGGUserToken"]

# Step 2: Make authenticated requests
headers = {"Dotgguserauth": f"{USER_ID}:{TOKEN}"}

# Get collection
response = requests.get(f"{API_BASE}/cgfw/getuserdata?game=lorcana", headers=headers)
data = response.json()
print(f"Collection has {len(data['collection'])} cards")

# Add card to collection
response = requests.post(
    f"{API_BASE}/cgfw/savecollection?game=lorcana",
    headers={**headers, "Content-Type": "application/json"},
    json={"card": "001-001", "type": "standard", "count": 4}
)
print(response.json())
```

---

## Supported Games

Use these values for the `game` parameter:

| Game                 | Parameter    |
| -------------------- | ------------ |
| Disney Lorcana       | `lorcana`    |
| Magic: The Gathering | `magic`      |
| Pokémon TCG          | `pokemon`    |
| Pokémon TCG Pocket   | `pokepocket` |
| Yu-Gi-Oh!            | `yugioh`     |
| Flesh and Blood      | `fabtcg`     |
| Star Wars Unlimited  | `starwars`   |
| One Piece            | `onepiece`   |
| Marvel Snap          | `marvelsnap` |
| Gundam Card Game     | `gundam`     |
| Cookie Run: Braverse | `cookierun`  |

---

## Collection Endpoints

All endpoints require the `game` parameter and the `Dotgguserauth` header.

### 1. Get User Collection

Fetch your full collection for a game.

**Endpoint:** `GET /cgfw/getuserdata?game={game}`

**Example:**

```bash
curl -X GET "https://api.dotgg.gg/cgfw/getuserdata?game=lorcana" \
  -H "Dotgguserauth: 12345:abc123def456"
```

**Response:**

```json
{
  "user": {
    "user_id": 12345,
    "nickname": "PlayerName",
    "user_registered": "2023-01-15"
  },
  "collection": [
    {
      "card": "001-001",
      "standard": "3",
      "foil": "1",
      "total": "4",
      "trade": "0",
      "wish": "0"
    },
    {
      "card": "001-002",
      "standard": "2",
      "foil": "0",
      "total": "2",
      "trade": "1",
      "wish": "0"
    }
  ]
}
```

---

### 2. Update Card Count

Add or update a single card in your collection.

**Endpoint:** `POST /cgfw/savecollection?game={game}`

**Example:**

```bash
curl -X POST "https://api.dotgg.gg/cgfw/savecollection?game=lorcana" \
  -H "Dotgguserauth: 12345:abc123def456" \
  -H "Content-Type: application/json" \
  -d '{"card": "001-001", "type": "standard", "count": 4}'
```

**Request Body:**

| Field   | Type   | Description                               |
| ------- | ------ | ----------------------------------------- |
| `card`  | string | **Required.** Card ID                     |
| `type`  | string | **Required.** `"standard"` or `"foil"`    |
| `count` | int    | **Required.** New quantity (≥0)           |
| `trade` | int    | Optional. Cards for trade (≤ total owned) |
| `wish`  | int    | Optional. Wishlist count                  |

**Note:** Each request updates one type (standard OR foil). To set both, make two requests.

**Response:**

```json
{
  "error": false,
  "newCount": 4
}
```

---

### 3. Bulk Import Collection

Import multiple cards at once. Uses max-merge (keeps higher count between existing and new).

**Endpoint:** `POST /cgfw/synclocalcollection?game={game}`

**Example:**

```bash
curl -X POST "https://api.dotgg.gg/cgfw/synclocalcollection?game=lorcana" \
  -H "Dotgguserauth: 12345:abc123def456" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"card": "001-001", "standard": "4", "foil": "1"},
      {"card": "001-002", "standard": "2", "foil": "0"},
      {"card": "002-015", "standard": "1", "foil": "2"}
    ]
  }'
```

**Response:**

```json
{
  "error": false,
  "message": "Collection synced",
  "synced": 3
}
```

---

### 4. Export Collection (CSV)

Download your entire collection as a CSV file.

**Endpoint:** `GET /cgfw/exportcollection?game={game}`

**Example:**

```bash
curl -X GET "https://api.dotgg.gg/cgfw/exportcollection?game=lorcana" \
  -H "Dotgguserauth: 12345:abc123def456" \
  -o collection.csv
```

**Response:** CSV file

```csv
CardId,Normal,Foil,Name,Set
001-001,3,1,"Ariel - On Human Legs","TFC"
001-002,2,0,"Mickey Mouse - Brave Little Tailor","TFC"
```

---

### 5. Reset Collection

**⚠️ DANGER:** Permanently deletes ALL collection data for the game. Cannot be undone.

**Endpoint:** `POST /cgfw/resetcollection?game={game}`

**Example:**

```bash
curl -X POST "https://api.dotgg.gg/cgfw/resetcollection?game=lorcana" \
  -H "Dotgguserauth: 12345:abc123def456"
```

**Response:**

```json
{
  "error": false,
  "message": "Collection reset successfully. 150 entries removed."
}
```

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "error": true,
  "error_text": "Error message here"
}
```

| Error                         | Cause                                  |
| ----------------------------- | -------------------------------------- |
| `"Not authorized!"`           | Missing/invalid `Dotgguserauth` header |
| `"Invalid game specified"`    | Unknown `game` parameter               |
| `"Card ID not found."`        | Card ID doesn't exist in game database |
| `"Invalid email or password"` | Auth endpoint: bad credentials         |

---

## Rate Limits

- No strict rate limits, but be reasonable
- Bulk import (`synclocalcollection`) is preferred over many `savecollection` calls
- For large operations, add small delays between requests

---

## Card IDs

Card IDs vary by game. Use the public `/cgfw/getcards` endpoint to get all cards:

```bash
curl "https://api.dotgg.gg/cgfw/getcards?game=lorcana"
```

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for full public API reference.
