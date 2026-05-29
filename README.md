# Socails

A self-hosted social media management platform. Schedule posts, manage your inbox, track analytics, and run AI-assisted workflows — all from one dashboard.

![Socails Dashboard](https://img.shields.io/badge/version-2.0.0-violet) ![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi) ![React](https://img.shields.io/badge/React-18-61DAFB?logo=react) ![MongoDB](https://img.shields.io/badge/MongoDB-Motor-47A248?logo=mongodb)

---

## Features

### Publish
- **Composer** — Write and schedule posts to multiple platforms simultaneously
- **Carousel Creator** — Build multi-slide carousels (LinkedIn / Instagram)
- **Calendar** — Drag-and-drop visual content calendar
- **Queue** — Slot-based publishing queue with best-time suggestions

### Monitor
- **Inbox** — Unified inbox for comments and DMs across all platforms; AI auto-tagging
- **Analytics** — Engagement charts, follower growth, heatmap, top posts, CSV export
- **Media Library** — Upload images, search Unsplash, manage hashtag groups

### Strategy
- **Content Pillars** — Define your content themes and tag posts to each pillar
- **SMART Goals** — Set and track measurable social media goals
- **UTM Builder** — Generate campaign tracking URLs instantly
- **90-Day Plan** — Research-backed checklist to grow from 0 → 2,000 followers

### AI
- Caption generation (tone-aware, platform-specific)
- Inbox message auto-tagging
- Post repurposing across platforms
- Sentiment analysis
- Media auto-tagging

### Developer
- REST API with interactive [Scalar](https://scalar.com) docs at `/api/docs`
- Webhook delivery (subscribe to post published / inbox events)
- API key management with scoped access

---

## Supported Platforms

| Platform | Connect | Post | Inbox | Analytics |
|---|---|---|---|---|
| LinkedIn | OAuth 2.0 | ✅ | ✅ | ✅ |
| Twitter / X | OAuth 2.0 PKCE | ✅ | ✅ | ✅ |
| Instagram | Meta OAuth | ✅ | ✅ | ✅ |
| Facebook | Meta OAuth | ✅ | ✅ | ✅ |
| TikTok | OAuth 2.0 | ✅ | — | ✅ |
| YouTube | OAuth 2.0 | ✅ | — | ✅ |

---

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | Python 3.11+, FastAPI, Motor (async MongoDB) |
| Frontend | React 18, Vite, Tailwind CSS, Recharts |
| Database | MongoDB |
| AI | Anthropic Claude API |
| Scheduler | APScheduler |
| Docs | Scalar API Reference |

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+ and npm
- MongoDB (local or Atlas)
- Anthropic API key

### 1. Clone the repo

```bash
git clone https://github.com/gaurvinayak/socails.git
cd socails
```

### 2. Backend setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS / Linux

# Install dependencies
pip install -r requirements.txt

# Copy env template and fill in your values
cp .env.example .env
```

Edit `backend/.env`:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=socails
BACKEND_URL=http://localhost:8002
FRONTEND_URL=http://localhost:3001

META_APP_ID=...
META_APP_SECRET=...

TWITTER_CLIENT_ID=...
TWITTER_CLIENT_SECRET=...

LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...

ANTHROPIC_API_KEY=...
```

Start the backend:

```bash
uvicorn server:app --reload --port 8002
```

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The app is now running at **http://localhost:3001**.  
API docs are at **http://localhost:8002/api/docs**.

---

## Environment Variables

| Variable | Description |
|---|---|
| `MONGO_URL` | MongoDB connection string |
| `DB_NAME` | Database name (default: `socails`) |
| `BACKEND_URL` | Backend base URL (used for OAuth redirect URIs) |
| `FRONTEND_URL` | Frontend base URL (used for OAuth redirects) |
| `META_APP_ID` | Meta (Facebook/Instagram) App ID |
| `META_APP_SECRET` | Meta App Secret |
| `TWITTER_CLIENT_ID` | Twitter OAuth 2.0 Client ID |
| `TWITTER_CLIENT_SECRET` | Twitter OAuth 2.0 Client Secret |
| `LINKEDIN_CLIENT_ID` | LinkedIn App Client ID |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn App Client Secret |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude AI features |

---

## Platform OAuth Setup

Each platform requires you to register redirect URIs in its developer portal:

| Platform | Redirect URI to register |
|---|---|
| Meta (Instagram + Facebook) | `http://localhost:8002/api/auth/instagram/callback` `http://localhost:8002/api/auth/facebook/callback` |
| Twitter / X | `http://localhost:8002/api/auth/twitter/callback` |
| LinkedIn | `http://localhost:8002/api/auth/linkedin/callback` |
| TikTok | `http://localhost:8002/api/auth/tiktok/callback` |
| YouTube | `http://localhost:8002/api/auth/youtube/callback` |

---

## API

Interactive API docs (Scalar) are served at:

```
http://localhost:8002/api/docs
```

The API is organized into 14 groups: Accounts, API Keys, Posts, Scheduler, Inbox, Analytics, Media Library, AI, Webhooks, Categories, Content Pillars, SMART Goals, 90-Day Plan, and OAuth.

---

## Project Structure

```
socails/
├── backend/
│   ├── server.py          # Main FastAPI app (~2,500 lines, all routes)
│   ├── ai.py              # Claude API helpers (captions, tagging, repurpose)
│   ├── publishing.py      # Cross-platform post publishing logic
│   ├── scheduler.py       # APScheduler job (queue processing)
│   ├── database.py        # Motor MongoDB client
│   ├── platforms/         # Per-platform OAuth + API clients
│   │   ├── linkedin.py
│   │   ├── twitter.py
│   │   ├── instagram.py
│   │   ├── facebook.py
│   │   ├── tiktok.py
│   │   └── youtube.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.jsx            # Routes
    │   ├── api.js             # Axios client + all API functions
    │   ├── components/
    │   │   ├── Layout.jsx
    │   │   └── Sidebar.jsx
    │   └── pages/
    │       ├── Composer.jsx
    │       ├── CarouselCreator.jsx
    │       ├── Calendar.jsx
    │       ├── Queue.jsx
    │       ├── Inbox.jsx
    │       ├── Analytics.jsx
    │       ├── Library.jsx
    │       ├── Pillars.jsx
    │       ├── Goals.jsx
    │       ├── UTMBuilder.jsx
    │       ├── PlanChecklist.jsx
    │       ├── AccountHub.jsx
    │       └── Settings.jsx
    ├── package.json
    └── vite.config.js
```

---

## License

MIT
