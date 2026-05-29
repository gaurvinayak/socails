# Socails — Social Media Management Tool
## Task & Feature Brief

---

### Vision

A single-pane-of-glass tool for managing all social media accounts — scheduling posts,
monitoring engagement, replying to comments/DMs, and surfacing analytics — without
switching between platform tabs. Every capability exposed in the UI is also available
as a documented REST API, so it can be used headlessly, integrated into other tools,
or automated via scripts.

---

### Platforms to Support (Phase 1)

| Platform       | Post | Analytics | Comments | DMs |
|----------------|------|-----------|----------|-----|
| Instagram      | ✓    | ✓         | ✓        | ✓   |
| X (Twitter)    | ✓    | ✓         | ✓        | ✓   |
| LinkedIn       | ✓    | ✓         | ✓        | —   |
| Facebook Page  | ✓    | ✓         | ✓        | ✓   |

Phase 2 targets: YouTube (comments only), Threads, Pinterest.

---

### Core Feature Areas

#### 1. Account Hub
- Connect/disconnect OAuth accounts per platform
- Show connected account health (token validity, rate limit status)
- Support multiple accounts per platform (e.g. two Instagram accounts)
- Workspace concept: group accounts under a named workspace

#### 2. Composer
- Rich text editor with per-platform character limits enforced live (X: 280, LinkedIn: 3000, etc.)
- Image/video upload with per-platform spec enforcement (aspect ratio, file size, resolution)
- Hashtag and mention auto-suggest
- Preview pane showing how the post will look on each platform
- Cross-post toggle: send the same post to multiple platforms at once, with per-platform overrides
- Thread/carousel builder for X and Instagram respectively
- First-comment scheduling (Instagram: schedule the hashtag comment)
- Alt-text field for accessibility on images

#### 3. Scheduler & Calendar
- Date/time picker with timezone support
- Visual calendar view (month/week/day) showing all scheduled and published posts
- Drag-to-reschedule on the calendar
- "Best time to post" suggestion per platform based on historical engagement
- Queue mode: drop posts into a pre-defined weekly time-slot queue (Buffer-style)
- Post status: Draft → Scheduled → Published → Failed (with error detail)
- Bulk CSV import of scheduled posts

#### 4. Unified Inbox
- Single feed aggregating comments and DMs from all connected accounts
- Filters: platform, account, unread, assigned, type (comment / DM / mention)
- Reply inline without leaving the app
- Mark as done / archive
- Emoji reactions (where the platform API allows)
- Keyboard shortcuts for triage (j/k navigate, r reply, d done)
- Auto-tag: AI labels incoming messages as Question, Complaint, Praise, Spam

#### 5. Analytics & Insights
- Per-post metrics: impressions, reach, likes, comments, shares, saves, clicks
- Account-level summary: follower growth over time, engagement rate, top posts
- Cross-platform comparison dashboard
- Best-performing content breakdown by type (image, video, carousel, text)
- Date range selector and comparison periods (this week vs. last week)
- Export to CSV / PDF report
- Scheduled email digest (weekly summary)

#### 6. Content Library
- Media asset library: upload and tag images/videos for reuse
- Caption templates / saved snippets
- Hashtag groups: save sets of hashtags and insert with one click
- AI caption generator: describe the post intent → get 3 draft captions (uses Anthropic API)

#### 7. Settings & Notifications
- Notification center: in-app + email alerts for post failures, new DMs, comment replies
- Brand kit: default logo, color palette, font for generated graphics
- Team roles: Owner, Editor, Viewer (Phase 2)
- Billing / plan management (Phase 2)

---

### Public REST API

Every action available in the UI is also exposed as a REST API endpoint. This enables:
- Headless use (post/schedule without the UI)
- Integration with third-party tools, webhooks, Zapier, Make, etc.
- CLI or script-based automation
- Mobile apps consuming the same backend

#### Authentication
- API Key authentication: generate named keys per workspace from the Settings page
- Keys are passed as `Authorization: Bearer <api_key>` on every request
- Keys are scoped: Read-only, Read+Write, or Full Access
- Rate limits per key are configurable (default: 1000 req/hour)

#### API Groups & Key Endpoints

**Accounts**
```
GET    /api/v1/accounts                        # list connected accounts
POST   /api/v1/accounts/connect                # initiate OAuth connect flow
DELETE /api/v1/accounts/{account_id}           # disconnect an account
GET    /api/v1/accounts/{account_id}/health    # token validity + rate limit status
```

**Posts**
```
POST   /api/v1/posts                           # create a post (draft or immediate)
GET    /api/v1/posts                           # list posts (filter by status, platform, date)
GET    /api/v1/posts/{post_id}                 # get a single post + its status
PATCH  /api/v1/posts/{post_id}                 # update a draft or reschedule
DELETE /api/v1/posts/{post_id}                 # delete a draft or cancel a scheduled post
POST   /api/v1/posts/{post_id}/publish         # publish immediately (bypasses schedule)
POST   /api/v1/posts/bulk                      # bulk create from JSON or CSV payload
```

**Scheduler / Queue**
```
GET    /api/v1/queue                           # view current queue
POST   /api/v1/queue/slots                     # set recurring time slots
DELETE /api/v1/queue/slots/{slot_id}           # remove a time slot
GET    /api/v1/posts/best-times/{platform}     # suggested best-time-to-post data
```

**Inbox**
```
GET    /api/v1/inbox                           # list messages/comments (filterable)
GET    /api/v1/inbox/{item_id}                 # get a single item + thread
POST   /api/v1/inbox/{item_id}/reply           # send a reply
PATCH  /api/v1/inbox/{item_id}                 # update status (done, archived, assigned)
GET    /api/v1/inbox/unread-count              # lightweight unread badge count
```

**Analytics**
```
GET    /api/v1/analytics/posts                 # per-post metrics (date range, platform filter)
GET    /api/v1/analytics/accounts              # account-level summary (followers, eng rate)
GET    /api/v1/analytics/top-posts             # top N posts ranked by a metric
GET    /api/v1/analytics/compare               # cross-platform comparison
GET    /api/v1/analytics/export                # download CSV/PDF report
```

**Media Library**
```
POST   /api/v1/media                           # upload a media asset
GET    /api/v1/media                           # list assets (tag/type filter)
DELETE /api/v1/media/{media_id}                # delete an asset
GET    /api/v1/media/hashtag-groups            # list saved hashtag groups
POST   /api/v1/media/hashtag-groups            # create a hashtag group
```

**AI**
```
POST   /api/v1/ai/caption                      # generate caption drafts from a prompt
POST   /api/v1/ai/tag-message                  # classify an inbox message
```

**Webhooks**
```
POST   /api/v1/webhooks                        # register a webhook URL + events
GET    /api/v1/webhooks                        # list registered webhooks
DELETE /api/v1/webhooks/{webhook_id}           # remove a webhook
```
Supported webhook events: `post.published`, `post.failed`, `inbox.new_message`, `inbox.new_comment`

---

### API Documentation Page

A built-in `/docs` route in the app renders interactive API documentation:

- **Auto-generated from OpenAPI 3.1 spec** — FastAPI exposes `/openapi.json` automatically
- **Custom docs UI** built on top of Scalar (modern, cleaner than Swagger UI) or Redoc
- Hosted at `/docs` in the frontend (or `/api/docs` if served from backend)
- Features:
  - Try-it-now: authenticated requests directly from the docs page using a workspace API key
  - Code snippets auto-generated in Python, JavaScript, cURL, and Go
  - Schema explorer: all request/response models documented with examples
  - Changelog section: API version history and breaking change notices
  - Dark mode support
- The raw OpenAPI spec is downloadable at `/api/openapi.json` for Postman/Insomnia import

---

### Tech Stack (Proposed)

| Layer           | Choice                                        | Rationale                                          |
|-----------------|-----------------------------------------------|----------------------------------------------------|
| Frontend        | React + Vite + Tailwind                       | Fast dev; consistent with designlab frontend       |
| Backend         | FastAPI (Python)                              | Consistent with existing stack; OpenAPI built-in   |
| API Docs UI     | Scalar or Redoc                               | Better DX than Swagger UI; renders OpenAPI 3.1     |
| Database        | MongoDB (Motor)                               | Consistent with existing stack; flexible schema    |
| Queue / Jobs    | APScheduler → Celery + Redis (Phase 2)        | Scheduled post dispatch                            |
| Auth            | OAuth 2.0 per platform + API Key for REST     | Industry standard; keys for headless access        |
| AI features     | Anthropic Claude API                          | Caption generation, inbox auto-tagging             |
| Storage         | Local filesystem → S3-compatible (Phase 2)   | Media library uploads                              |
| Testing         | Pytest (backend), Vitest (frontend)           | Consistent with existing repo                      |

---

### Folder Structure (Proposed)

```
socails/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Composer.jsx
│   │   │   ├── Calendar.jsx
│   │   │   ├── Inbox.jsx
│   │   │   ├── Analytics.jsx
│   │   │   ├── Library.jsx
│   │   │   ├── ApiDocs.jsx       ← hosts Scalar/Redoc component
│   │   │   └── Settings.jsx
│   │   ├── components/
│   │   └── api.js
│   └── package.json
├── backend/
│   ├── server.py                 ← FastAPI app (OpenAPI auto-generated)
│   ├── platforms/                ← per-platform API clients
│   │   ├── instagram.py
│   │   ├── twitter.py
│   │   ├── linkedin.py
│   │   └── facebook.py
│   ├── scheduler.py
│   ├── ai.py
│   └── tests/
└── .env.example
```

---

### Phased Rollout

| Phase | Scope                                           | Deliverable                                    |
|-------|-------------------------------------------------|------------------------------------------------|
| **0** | Scaffold, OAuth connect flow, account hub UI    | Connect accounts; API Keys; /docs page live    |
| **1** | Composer, immediate + scheduled posting, calendar | Post to all 4 platforms via UI and API       |
| **2** | Unified inbox, replies, auto-tag                | Triage comments/DMs from one place             |
| **3** | Analytics dashboard + export                   | Measure performance; export reports            |
| **4** | Media library + AI captions                    | Content creation speed-ups                     |
| **5** | Webhooks, team roles, billing                  | Production-ready for wider use                 |

---

### Decisions Locked

| # | Question | Decision |
|---|----------|----------|
| 1 | Platform priority | All 4 platforms (Instagram, X, LinkedIn, Facebook) simultaneously — go deep on each |
| 2 | Auth | Standalone app, no auth layer for now — open access locally |
| 3 | API docs host | FastAPI serves `/api/docs` (Scalar UI); frontend links there |
| 4 | AI inbox tagging | On by default — message snippets sent to Claude API |
| 5 | Media storage | Local filesystem only for now |
| 6 | Mobile | Responsive web only |
