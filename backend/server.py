import hashlib
import os
import secrets
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

import aiofiles
from dotenv import load_dotenv
from fastapi import Body, FastAPI, File, Form, HTTPException, Path, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

load_dotenv()

import ai as ai_module
import platforms.facebook as facebook_platform
import platforms.instagram as instagram_platform
import platforms.linkedin as linkedin_platform
import platforms.tiktok as tiktok_platform
import platforms.twitter as twitter_platform
import platforms.youtube as youtube_platform
from database import connect_db, disconnect_db, get_db
from publishing import publish_post as do_publish
from scheduler import fire_webhooks, start_scheduler, stop_scheduler

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3001")
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    start_scheduler()
    yield
    stop_scheduler()
    await disconnect_db()


OPENAPI_TAGS = [
    {
        "name": "OAuth",
        "description": (
            "Connect social accounts via OAuth 2.0. "
            "Each platform returns an `auth_url` — redirect the user there, "
            "and the callback will store tokens and redirect back to the frontend."
        ),
    },
    {
        "name": "Accounts",
        "description": "Manage connected social accounts. List, disconnect, and check token health.",
    },
    {
        "name": "API Keys",
        "description": (
            "Generate and revoke API keys for programmatic access. "
            "Keys are returned **once** at creation — store them securely."
        ),
    },
    {
        "name": "Posts",
        "description": (
            "Create, schedule, publish, and manage posts. "
            "Supports single posts, Twitter/X threads, LinkedIn carousels (PDF), bulk JSON, and bulk CSV. "
            "Posts can be cloned, retried after failure, or flagged as evergreen for recycling."
        ),
    },
    {
        "name": "Scheduler",
        "description": (
            "View the publishing queue, manage time slots, and get platform-specific best-time suggestions "
            "based on Buffer's 52M-post engagement research."
        ),
    },
    {
        "name": "Inbox",
        "description": (
            "Unified inbox for comments and DMs across all connected platforms. "
            "Supports reply templates, keyword alerts, and AI-powered auto-tagging "
            "(Question / Complaint / Praise / Spam / Other)."
        ),
    },
    {
        "name": "Analytics",
        "description": (
            "Post performance metrics, publishing heatmaps, follower growth over time, "
            "and CSV/PDF export. "
            "Snapshot follower counts manually via `POST /api/v1/accounts/snapshot-followers` "
            "then chart growth via `GET /api/v1/analytics/follower-growth`."
        ),
    },
    {
        "name": "Media Library",
        "description": (
            "Upload and manage images/videos. "
            "Includes hashtag group presets, brand kit (colours, fonts, logo), "
            "Unsplash stock photo search, and AI-powered image tagging."
        ),
    },
    {
        "name": "AI",
        "description": (
            "Claude-powered content tools. "
            "**Caption generator** — 3 platform-optimised drafts. "
            "**Repurpose** — reformat a post for multiple platforms in one call (LinkedIn → Twitter thread → TikTok script → Instagram caption). "
            "**Inbox tagger** — classify messages. "
            "**Sentiment** — positive / negative / neutral. "
            "**Image tagger** — suggest media library tags from a URL."
        ),
    },
    {
        "name": "Webhooks",
        "description": (
            "Register HTTPS endpoints to receive real-time event payloads. "
            "Events: `post.published`, `post.failed`, `inbox.new_item`."
        ),
    },
    {
        "name": "Categories",
        "description": "Custom content categories for organising posts (separate from content pillars).",
    },
    {
        "name": "Content Pillars",
        "description": (
            "The 5 core topics every post maps to, based on Buffer's research that "
            "topical authority drives 30–40% more organic reach. "
            "Five SDL-specific defaults are seeded on first request. "
            "Custom pillars can be added; default pillars cannot be deleted."
        ),
    },
    {
        "name": "Goals",
        "description": (
            "SMART goal tracking for followers, engagement rate, posts/week, trial signups, and website sessions. "
            "Set a target + deadline, then update `current_value` as you hit milestones."
        ),
    },
    {
        "name": "90-Day Plan",
        "description": (
            "Buffer research-backed 26-item launch checklist across four phases: "
            "Days 1–14 (foundations), 15–30 (consistency), 31–60 (amplification), 61–90 (conversion). "
            "Items are seeded on first request and persist per user."
        ),
    },
]

app = FastAPI(
    title="Socails API",
    description="""
Social media management API — every UI action in the Socails dashboard is also a REST endpoint.

## Authentication
Generate API keys from the **Settings → API Keys** page or via `POST /api/v1/keys`.
Pass as `Authorization: Bearer <api_key>` on every request.

## OAuth Connect Flow
1. `GET /api/auth/{platform}/connect` → returns `{ auth_url }`
2. Redirect user → platform OAuth consent screen
3. Platform redirects back → `GET /api/auth/{platform}/callback`
4. Backend stores tokens → 302 to `{FRONTEND_URL}/accounts?connected={platform}`

## Supported Platforms
| Platform | OAuth flow | Credentials needed |
|---|---|---|
| **Instagram** | Meta OAuth 2.0 | `META_APP_ID`, `META_APP_SECRET` |
| **X (Twitter)** | PKCE OAuth 2.0 | `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET` |
| **LinkedIn** | OAuth 2.0 | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` |
| **Facebook** | Meta OAuth 2.0 | `META_APP_ID`, `META_APP_SECRET` |
| **TikTok** | PKCE OAuth 2.0 | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` |
| **YouTube** | Google OAuth 2.0 (offline) | `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` |

## Strategy Features
The following endpoints power the **STRATEGY** section of the dashboard, based on Buffer's analysis of 52M+ posts:

| Feature | Endpoint prefix | Purpose |
|---|---|---|
| Content Pillars | `/api/v1/pillars` | Map every post to one of 5 topical buckets |
| SMART Goals | `/api/v1/goals` | Track follower, engagement & conversion targets |
| 90-Day Plan | `/api/v1/plan/checklist` | 26-step launch checklist across 4 phases |
| Follower Growth | `/api/v1/analytics/follower-growth` | Chart follower counts over time |
| AI Repurpose | `/api/v1/ai/repurpose` | Reformat a post for any target platform |
| LinkedIn Carousel | `/api/v1/posts/carousel` | Build slide-deck posts rendered as PDF |
| Metrics Refresh | `/api/v1/posts/{id}/refresh-metrics` | Pull live engagement data from platform APIs |
""",
    version="2.0.0",
    openapi_tags=OPENAPI_TAGS,
    docs_url=None,
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class Account(BaseModel):
    account_id: str
    platform: str
    username: str
    display_name: str
    profile_image_url: str
    followers_count: int = 0
    connected_at: datetime
    is_active: bool
    token_expires_at: Optional[datetime] = None
    page_id: Optional[str] = None


class ApiKeyCreate(BaseModel):
    name: str
    scope: Literal["read", "read_write", "full"] = "read_write"


class PostCreate(BaseModel):
    account_id: str
    content: str
    media_urls: list[str] = []
    scheduled_at: Optional[datetime] = None
    pillar_id: Optional[str] = None
    category_id: Optional[str] = None
    tags: list[str] = []


class ReplyCreate(BaseModel):
    content: str


class WebhookCreate(BaseModel):
    url: str
    events: list[Literal["post.published", "post.failed", "inbox.new_message", "inbox.new_comment"]]


class CaptionRequest(BaseModel):
    prompt: str
    platform: Optional[str] = None
    tone: str = "engaging"


class TagRequest(BaseModel):
    content: str


class ThreadCreate(BaseModel):
    account_id: str
    tweets: list[str]
    media_urls: list[list[str]] = []
    scheduled_at: Optional[datetime] = None


class QueueSlotCreate(BaseModel):
    day_of_week: int
    hour: int
    minute: int = 0
    platforms: list[str] = []


class CategoryCreate(BaseModel):
    name: str
    color: str = "#8b5cf6"
    description: str = ""


class AlertCreate(BaseModel):
    keyword: str


# ---------------------------------------------------------------------------
# OAuth
# ---------------------------------------------------------------------------

PLATFORM_MAP = {
    "instagram": instagram_platform,
    "twitter": twitter_platform,
    "linkedin": linkedin_platform,
    "facebook": facebook_platform,
    "tiktok": tiktok_platform,
    "youtube": youtube_platform,
}


@app.get("/api/auth/{platform}/connect", tags=["OAuth"], summary="Get OAuth authorization URL")
async def connect_platform(platform: str = Path(...)):
    if platform not in PLATFORM_MAP:
        raise HTTPException(status_code=404, detail=f"Unknown platform: {platform}")

    db = get_db()
    state = secrets.token_urlsafe(32)
    state_doc = {"state": state, "platform": platform, "created_at": datetime.now(timezone.utc)}

    if platform == "twitter":
        code_verifier, code_challenge = twitter_platform.generate_pkce_pair()
        state_doc["code_verifier"] = code_verifier
        auth_url = twitter_platform.get_auth_url(state, code_challenge)
    elif platform == "tiktok":
        code_verifier, code_challenge = tiktok_platform.generate_pkce_pair()
        state_doc["code_verifier"] = code_verifier
        auth_url = tiktok_platform.get_auth_url(state, code_challenge)
    elif platform == "instagram":
        auth_url = instagram_platform.get_auth_url(state)
    elif platform == "linkedin":
        auth_url = linkedin_platform.get_auth_url(state)
    elif platform == "youtube":
        auth_url = youtube_platform.get_auth_url(state)
    else:
        auth_url = facebook_platform.get_auth_url(state)

    await db.oauth_states.insert_one(state_doc)
    return {"auth_url": auth_url, "state": state}


@app.get("/api/auth/{platform}/callback", include_in_schema=False)
async def oauth_callback(
    platform: str,
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None),
):
    if error:
        return RedirectResponse(f"{FRONTEND_URL}/accounts?error={(error_description or error)[:120]}")
    if not code or not state:
        return RedirectResponse(f"{FRONTEND_URL}/accounts?error=missing_code_or_state")

    db = get_db()
    state_doc = await db.oauth_states.find_one({"state": state, "platform": platform})
    if not state_doc:
        return RedirectResponse(f"{FRONTEND_URL}/accounts?error=invalid_or_expired_state")

    await db.oauth_states.delete_one({"state": state})

    try:
        count = 0

        if platform == "twitter":
            tokens = await twitter_platform.exchange_code(code, state_doc["code_verifier"])
            profile = await twitter_platform.get_user_profile(tokens["access_token"])
            doc = {
                "account_id": str(uuid.uuid4()),
                "platform": "twitter",
                "platform_user_id": profile["platform_user_id"],
                "username": profile["username"],
                "display_name": profile["display_name"],
                "profile_image_url": profile["profile_image_url"],
                "followers_count": profile.get("followers_count", 0),
                "access_token": tokens["access_token"],
                "refresh_token": tokens.get("refresh_token"),
                "token_expires_at": None,
                "scopes": tokens.get("scope", "").split(),
                "connected_at": datetime.now(timezone.utc),
                "is_active": True,
            }
            await db.accounts.update_one(
                {"platform": "twitter", "platform_user_id": profile["platform_user_id"]},
                {"$set": doc}, upsert=True,
            )
            count = 1

        elif platform == "instagram":
            tokens = await instagram_platform.exchange_code(code)
            long_lived = await instagram_platform.get_long_lived_token(tokens["access_token"])
            ig_accounts = await instagram_platform.get_instagram_accounts(long_lived["access_token"])
            expires_at = datetime.now(timezone.utc) + timedelta(seconds=long_lived.get("expires_in", 5_184_000))
            for ig in ig_accounts:
                doc = {
                    "account_id": str(uuid.uuid4()),
                    "platform": "instagram",
                    "platform_user_id": ig["platform_user_id"],
                    "username": ig["username"],
                    "display_name": ig["display_name"],
                    "profile_image_url": ig["profile_image_url"],
                    "followers_count": ig.get("followers_count", 0),
                    "access_token": long_lived["access_token"],
                    "refresh_token": None,
                    "token_expires_at": expires_at,
                    "scopes": ["instagram_basic", "instagram_content_publish", "instagram_manage_comments"],
                    "connected_at": datetime.now(timezone.utc),
                    "is_active": True,
                    "page_id": ig["page_id"],
                }
                await db.accounts.update_one(
                    {"platform": "instagram", "platform_user_id": ig["platform_user_id"]},
                    {"$set": doc}, upsert=True,
                )
                count += 1

        elif platform == "linkedin":
            tokens = await linkedin_platform.exchange_code(code)
            profile = await linkedin_platform.get_user_profile(tokens["access_token"])
            expires_at = datetime.now(timezone.utc) + timedelta(seconds=tokens.get("expires_in", 5_184_000))
            doc = {
                "account_id": str(uuid.uuid4()),
                "platform": "linkedin",
                "platform_user_id": profile["platform_user_id"],
                "username": profile["username"],
                "display_name": profile["display_name"],
                "profile_image_url": profile["profile_image_url"],
                "followers_count": 0,
                "access_token": tokens["access_token"],
                "refresh_token": tokens.get("refresh_token"),
                "token_expires_at": expires_at,
                "scopes": tokens.get("scope", "").split(),
                "connected_at": datetime.now(timezone.utc),
                "is_active": True,
            }
            await db.accounts.update_one(
                {"platform": "linkedin", "platform_user_id": profile["platform_user_id"]},
                {"$set": doc}, upsert=True,
            )
            count = 1

        elif platform == "tiktok":
            tokens = await tiktok_platform.exchange_code(code, state_doc["code_verifier"])
            profile = await tiktok_platform.get_user_profile(tokens["access_token"])
            expires_at = datetime.now(timezone.utc) + timedelta(seconds=tokens.get("expires_in", 86400))
            doc = {
                "account_id": str(uuid.uuid4()),
                "platform": "tiktok",
                "platform_user_id": profile["platform_user_id"],
                "username": profile["username"],
                "display_name": profile["display_name"],
                "profile_image_url": profile["profile_image_url"],
                "followers_count": profile.get("followers_count", 0),
                "access_token": tokens["access_token"],
                "refresh_token": tokens.get("refresh_token"),
                "token_expires_at": expires_at,
                "scopes": tokens.get("scope", "").split(","),
                "connected_at": datetime.now(timezone.utc),
                "is_active": True,
            }
            await db.accounts.update_one(
                {"platform": "tiktok", "platform_user_id": profile["platform_user_id"]},
                {"$set": doc}, upsert=True,
            )
            count = 1

        elif platform == "youtube":
            tokens = await youtube_platform.exchange_code(code)
            profile = await youtube_platform.get_user_profile(tokens["access_token"])
            expires_at = datetime.now(timezone.utc) + timedelta(seconds=tokens.get("expires_in", 3600))
            doc = {
                "account_id": str(uuid.uuid4()),
                "platform": "youtube",
                "platform_user_id": profile["platform_user_id"],
                "username": profile["username"],
                "display_name": profile["display_name"],
                "profile_image_url": profile["profile_image_url"],
                "followers_count": profile.get("followers_count", 0),
                "access_token": tokens["access_token"],
                "refresh_token": tokens.get("refresh_token"),
                "token_expires_at": expires_at,
                "scopes": PLATFORM_MAP["youtube"].__dict__.get("SCOPES", []),
                "connected_at": datetime.now(timezone.utc),
                "is_active": True,
            }
            await db.accounts.update_one(
                {"platform": "youtube", "platform_user_id": profile["platform_user_id"]},
                {"$set": doc}, upsert=True,
            )
            count = 1

        elif platform == "facebook":
            tokens = await facebook_platform.exchange_code(code)
            long_lived = await facebook_platform.get_long_lived_token(tokens["access_token"])
            pages = await facebook_platform.get_pages(long_lived["access_token"])
            for page in pages:
                doc = {
                    "account_id": str(uuid.uuid4()),
                    "platform": "facebook",
                    "platform_user_id": page["platform_user_id"],
                    "username": page["username"],
                    "display_name": page["display_name"],
                    "profile_image_url": page["profile_image_url"],
                    "followers_count": page.get("followers_count", 0),
                    "access_token": page["page_access_token"],
                    "refresh_token": None,
                    "token_expires_at": None,
                    "scopes": ["pages_manage_posts", "pages_read_engagement", "pages_messaging"],
                    "connected_at": datetime.now(timezone.utc),
                    "is_active": True,
                    "page_id": page["platform_user_id"],
                }
                await db.accounts.update_one(
                    {"platform": "facebook", "platform_user_id": page["platform_user_id"]},
                    {"$set": doc}, upsert=True,
                )
                count += 1

        return RedirectResponse(f"{FRONTEND_URL}/accounts?connected={platform}&count={count}")

    except Exception as exc:
        return RedirectResponse(f"{FRONTEND_URL}/accounts?error={str(exc)[:120]}")


# ---------------------------------------------------------------------------
# Accounts
# ---------------------------------------------------------------------------

@app.get("/api/v1/accounts", tags=["Accounts"], response_model=list[Account], summary="List connected accounts")
async def list_accounts(platform: Optional[str] = Query(None)):
    db = get_db()
    query: dict = {"is_active": True}
    if platform:
        query["platform"] = platform
    return await db.accounts.find(query, {"_id": 0}).to_list(200)


@app.delete("/api/v1/accounts/{account_id}", tags=["Accounts"], summary="Disconnect an account")
async def disconnect_account(account_id: str):
    db = get_db()
    result = await db.accounts.update_one({"account_id": account_id}, {"$set": {"is_active": False}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    return {"status": "disconnected"}


@app.get("/api/v1/accounts/{account_id}/health", tags=["Accounts"], summary="Check token validity")
async def account_health(account_id: str):
    db = get_db()
    account = await db.accounts.find_one({"account_id": account_id}, {"_id": 0})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    now = datetime.now(timezone.utc)
    expires_at = account.get("token_expires_at")
    if not expires_at:
        status, days = "valid", None
    else:
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        delta = (expires_at - now).days
        if delta <= 0:
            status, days = "expired", 0
        else:
            status = "expiring_soon" if delta < 7 else "valid"
            days = delta
    return {"account_id": account_id, "platform": account["platform"], "status": status, "expires_in_days": days}


# ---------------------------------------------------------------------------
# API Keys
# ---------------------------------------------------------------------------

@app.post("/api/v1/keys", tags=["API Keys"], summary="Generate API key (returned once)")
async def create_api_key(body: ApiKeyCreate):
    db = get_db()
    raw = f"soc_{secrets.token_urlsafe(32)}"
    doc = {
        "key_id": str(uuid.uuid4()),
        "name": body.name,
        "scope": body.scope,
        "key_hash": hashlib.sha256(raw.encode()).hexdigest(),
        "prefix": raw[:12],
        "created_at": datetime.now(timezone.utc),
        "last_used_at": None,
        "is_active": True,
    }
    await db.api_keys.insert_one(doc)
    doc.pop("_id", None)
    return {**doc, "key": raw}


@app.get("/api/v1/keys", tags=["API Keys"], summary="List API keys")
async def list_api_keys():
    db = get_db()
    return await db.api_keys.find({"is_active": True}, {"_id": 0, "key_hash": 0}).to_list(100)


@app.delete("/api/v1/keys/{key_id}", tags=["API Keys"], summary="Revoke an API key")
async def revoke_api_key(key_id: str):
    db = get_db()
    result = await db.api_keys.update_one({"key_id": key_id}, {"$set": {"is_active": False}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Key not found")
    return {"status": "revoked"}


# ---------------------------------------------------------------------------
# Posts
# ---------------------------------------------------------------------------

@app.post("/api/v1/posts", tags=["Posts"], summary="Create a post (draft or scheduled)")
async def create_post(body: PostCreate):
    db = get_db()
    account = await db.accounts.find_one({"account_id": body.account_id, "is_active": True})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    doc = {
        "post_id": str(uuid.uuid4()),
        "platform": account["platform"],
        "account_id": body.account_id,
        "content": body.content,
        "media_urls": body.media_urls,
        "status": "scheduled" if body.scheduled_at else "draft",
        "scheduled_at": body.scheduled_at,
        "published_at": None,
        "error_message": None,
        "platform_post_id": None,
        "pillar_id": body.pillar_id,
        "category_id": body.category_id,
        "tags": body.tags,
        "metrics": {},
        "created_at": datetime.now(timezone.utc),
        "updated_at": None,
    }
    await db.posts.insert_one(doc)
    doc.pop("_id", None)
    return doc


@app.get("/api/v1/posts", tags=["Posts"], summary="List posts")
async def list_posts(
    platform: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    account_id: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
):
    db = get_db()
    query: dict = {}
    if platform:
        query["platform"] = platform
    if status:
        query["status"] = status
    if account_id:
        query["account_id"] = account_id
    return await db.posts.find(query, {"_id": 0}).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)


@app.get("/api/v1/posts/{post_id}", tags=["Posts"], summary="Get a post")
async def get_post(post_id: str):
    db = get_db()
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@app.patch("/api/v1/posts/{post_id}", tags=["Posts"], summary="Update a draft or reschedule")
async def update_post(post_id: str, body: dict = Body(...)):
    db = get_db()
    # Metadata fields (pillar, category, tags) can be updated on any post status
    META_FIELDS = {"pillar_id", "category_id", "tags"}
    # Content fields only allowed on draft/scheduled posts
    CONTENT_FIELDS = {"content", "media_urls", "scheduled_at"}

    meta_update = {k: v for k, v in body.items() if k in META_FIELDS}
    content_update = {k: v for k, v in body.items() if k in CONTENT_FIELDS}

    if not meta_update and not content_update:
        raise HTTPException(status_code=400, detail="No updatable fields")

    update: dict = {**meta_update}
    update["updated_at"] = datetime.now(timezone.utc)

    if content_update:
        # Only apply content updates to draft/scheduled posts
        post = await db.posts.find_one({"post_id": post_id}, {"status": 1})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        if post.get("status") not in ("draft", "scheduled"):
            raise HTTPException(status_code=400, detail="Cannot edit content of a published/failed post — clone it instead")
        update.update(content_update)

    result = await db.posts.update_one({"post_id": post_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"status": "updated"}


@app.delete("/api/v1/posts/{post_id}", tags=["Posts"], summary="Delete a draft or cancel scheduled post")
async def delete_post(post_id: str):
    db = get_db()
    result = await db.posts.delete_one({"post_id": post_id, "status": {"$in": ["draft", "scheduled"]}})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Post not found or already published")
    return {"status": "deleted"}


@app.post("/api/v1/posts/{post_id}/publish", tags=["Posts"], summary="Publish immediately via platform API")
async def publish_post_endpoint(post_id: str):
    db = get_db()
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post["status"] == "published":
        return {"status": "already_published", "post_id": post_id}
    result = await do_publish(post, db)
    # Fire webhooks (same events the scheduler fires for scheduled posts)
    event = "post.published" if result["status"] == "published" else "post.failed"
    await fire_webhooks(db, event, {"post_id": post_id, "platform": post["platform"], **result})
    if result["status"] == "failed":
        raise HTTPException(status_code=502, detail=result.get("error", "Publish failed"))
    return {"status": "published", "post_id": post_id, **result}


@app.post("/api/v1/posts/bulk", tags=["Posts"], summary="Bulk-create posts from JSON array")
async def bulk_create_posts(posts: list[PostCreate]):
    results = [await create_post(p) for p in posts]
    return {"created": len(results), "posts": results}


# ---------------------------------------------------------------------------
# Scheduler / Queue
# ---------------------------------------------------------------------------

@app.get("/api/v1/queue", tags=["Scheduler"], summary="View scheduled post queue")
async def get_queue(platform: Optional[str] = Query(None), account_id: Optional[str] = Query(None)):
    db = get_db()
    query: dict = {"status": "scheduled"}
    if platform:
        query["platform"] = platform
    if account_id:
        query["account_id"] = account_id
    posts = await db.posts.find(query, {"_id": 0}).sort("scheduled_at", 1).limit(200).to_list(200)
    return {"queue": posts, "count": len(posts)}


@app.get("/api/v1/scheduler/best-times/{platform}", tags=["Scheduler"], summary="Suggested best posting times")
async def best_times(platform: str):
    suggestions = {
        "instagram": [{"day": "Tuesday", "time": "09:00"}, {"day": "Wednesday", "time": "11:00"}, {"day": "Friday", "time": "10:00"}],
        "twitter":   [{"day": "Monday",  "time": "08:00"}, {"day": "Wednesday", "time": "12:00"}, {"day": "Thursday", "time": "17:00"}],
        "linkedin":  [{"day": "Tuesday", "time": "08:00"}, {"day": "Wednesday", "time": "10:00"}, {"day": "Thursday", "time": "09:00"}],
        "facebook":  [{"day": "Wednesday","time": "13:00"}, {"day": "Thursday", "time": "14:00"}, {"day": "Friday",  "time": "11:00"}],
    }
    if platform not in suggestions:
        raise HTTPException(status_code=404, detail="Unknown platform")
    return {"platform": platform, "suggestions": suggestions[platform]}


# ---------------------------------------------------------------------------
# Inbox
# ---------------------------------------------------------------------------

@app.get("/api/v1/inbox", tags=["Inbox"], summary="List inbox items")
async def list_inbox(
    platform: Optional[str] = Query(None),
    account_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    item_type: Optional[str] = Query(None, alias="type"),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
):
    db = get_db()
    query: dict = {}
    if platform: query["platform"] = platform
    if account_id: query["account_id"] = account_id
    if status: query["status"] = status
    if item_type: query["type"] = item_type
    return await db.inbox_items.find(query, {"_id": 0}).sort("received_at", -1).skip(offset).limit(limit).to_list(limit)


@app.get("/api/v1/inbox/unread-count", tags=["Inbox"], summary="Unread count")
async def unread_count():
    db = get_db()
    return {"unread_count": await db.inbox_items.count_documents({"status": "unread"})}


@app.get("/api/v1/inbox/templates", tags=["Inbox"], summary="List reply templates")
async def list_reply_templates():
    db = get_db()
    return await db.reply_templates.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)


@app.post("/api/v1/inbox/templates", tags=["Inbox"], summary="Create a reply template")
async def create_reply_template(body: dict = Body(...)):
    db = get_db()
    doc = {
        "template_id": str(uuid.uuid4()),
        "name": body.get("name", ""),
        "content": body.get("content", ""),
        "created_at": datetime.now(timezone.utc),
    }
    await db.reply_templates.insert_one(doc)
    doc.pop("_id", None)
    return doc


@app.delete("/api/v1/inbox/templates/{template_id}", tags=["Inbox"], summary="Delete a reply template")
async def delete_reply_template(template_id: str):
    db = get_db()
    result = await db.reply_templates.delete_one({"template_id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"status": "deleted"}


@app.get("/api/v1/inbox/{item_id}", tags=["Inbox"], summary="Get a single inbox item")
async def get_inbox_item(item_id: str):
    db = get_db()
    item = await db.inbox_items.find_one({"item_id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@app.post("/api/v1/inbox/{item_id}/reply", tags=["Inbox"], summary="Reply to a comment or DM")
async def reply_to_inbox(item_id: str, body: ReplyCreate):
    db = get_db()
    item = await db.inbox_items.find_one({"item_id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    # TODO Phase 2: call platform API to send the reply
    replied_at = datetime.now(timezone.utc).isoformat()
    reply_doc = {
        "content": body.content,
        "replied_at": replied_at,
    }
    await db.inbox_items.update_one(
        {"item_id": item_id},
        {
            "$set": {"status": "done", "replied_at": replied_at},
            "$push": {"replies": reply_doc},
        },
    )
    return {"status": "reply_sent", "content": body.content, "replied_at": replied_at}


@app.patch("/api/v1/inbox/{item_id}", tags=["Inbox"], summary="Update status or tags")
async def update_inbox_item(item_id: str, body: dict = Body(...)):
    db = get_db()
    update = {k: v for k, v in body.items() if k in {"status", "assigned_to", "tags", "sentiment"}}
    result = await db.inbox_items.update_one({"item_id": item_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"status": "updated"}


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

@app.get("/api/v1/analytics/summary", tags=["Analytics"], summary="Aggregated stats from stored posts")
async def analytics_summary(days: int = Query(30, le=365)):
    db = get_db()
    start = datetime.now(timezone.utc) - timedelta(days=days)
    date_filter = {"created_at": {"$gte": start}}

    total_posts = await db.posts.count_documents(date_filter)
    by_status = {s: await db.posts.count_documents({"status": s, **date_filter}) for s in ["draft", "scheduled", "published", "failed"]}
    by_platform = {p: await db.posts.count_documents({"platform": p, **date_filter}) for p in ["instagram", "twitter", "linkedin", "facebook", "tiktok", "youtube"]}
    connected_accounts = await db.accounts.count_documents({"is_active": True})
    unread_inbox = await db.inbox_items.count_documents({"status": "unread"})

    recent = await db.posts.find({"created_at": {"$gte": start}}, {"created_at": 1, "_id": 0}).to_list(2000)
    date_counts: dict = {}
    for p in recent:
        d = p["created_at"].strftime("%Y-%m-%d") if hasattr(p["created_at"], "strftime") else str(p["created_at"])[:10]
        date_counts[d] = date_counts.get(d, 0) + 1

    posts_over_time = [
        {"date": (start + timedelta(days=i)).strftime("%Y-%m-%d"),
         "count": date_counts.get((start + timedelta(days=i)).strftime("%Y-%m-%d"), 0)}
        for i in range(days)
    ]

    return {
        "total_posts": total_posts,
        "posts_by_status": by_status,
        "posts_by_platform": by_platform,
        "posts_over_time": posts_over_time,
        "connected_accounts": connected_accounts,
        "unread_inbox": unread_inbox,
    }


@app.get("/api/v1/analytics/posts", tags=["Analytics"], summary="Per-post metrics")
async def post_metrics(
    platform: Optional[str] = Query(None),
    account_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
):
    db = get_db()
    query: dict = {"status": "published"}
    if platform: query["platform"] = platform
    if account_id: query["account_id"] = account_id
    posts = await db.posts.find(query, {"_id": 0}).sort("published_at", -1).limit(limit).to_list(limit)
    return posts


@app.get("/api/v1/analytics/top-posts", tags=["Analytics"], summary="Top posts by engagement (likes + comments + shares)")
async def top_posts(platform: Optional[str] = Query(None), limit: int = Query(10, le=50)):
    db = get_db()
    query: dict = {"status": "published"}
    if platform:
        query["platform"] = platform
    # Fetch a larger pool then sort by engagement score in Python
    # (MongoDB $add on nested fields requires aggregation pipeline)
    posts = await db.posts.find(query, {"_id": 0}).sort("published_at", -1).limit(500).to_list(500)

    def engagement_score(p: dict) -> int:
        m = p.get("metrics") or {}
        return (
            (m.get("likes") or 0)
            + (m.get("comments") or 0)
            + (m.get("shares") or 0)
            + (m.get("reach") or 0) // 10  # weight reach lower
        )

    posts.sort(key=engagement_score, reverse=True)
    return posts[:limit]


@app.get("/api/v1/analytics/export", tags=["Analytics"], summary="Export post data as CSV")
async def export_analytics():
    db = get_db()
    posts = await db.posts.find({}, {"_id": 0}).to_list(5000)
    headers = [
        "post_id", "platform", "status", "content",
        "pillar_id", "category_id", "tags",
        "likes", "comments", "shares", "reach",
        "scheduled_at", "published_at", "created_at",
    ]
    lines = [",".join(headers)]
    for p in posts:
        m = p.get("metrics") or {}
        tag_str = "|".join(p.get("tags") or [])
        lines.append(",".join([
            str(p.get("post_id", "")),
            str(p.get("platform", "")),
            str(p.get("status", "")),
            f'"{str(p.get("content","")).replace(chr(34), chr(39))}"',
            str(p.get("pillar_id", "") or ""),
            str(p.get("category_id", "") or ""),
            f'"{tag_str}"',
            str(m.get("likes", "") or ""),
            str(m.get("comments", "") or ""),
            str(m.get("shares", "") or ""),
            str(m.get("reach", "") or ""),
            str(p.get("scheduled_at", "") or ""),
            str(p.get("published_at", "") or ""),
            str(p.get("created_at", "") or ""),
        ]))
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse("\n".join(lines), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=posts.csv"})


# ---------------------------------------------------------------------------
# Media Library
# ---------------------------------------------------------------------------

@app.post("/api/v1/media", tags=["Media Library"], summary="Upload a media asset")
async def upload_media(
    file: UploadFile = File(...),
    tags: str = Form(""),
):
    allowed_exts = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".mov", ".avi"}
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"File type {ext} not allowed")

    file_id = str(uuid.uuid4())
    filename = f"{file_id}{ext}"
    filepath = os.path.join(UPLOADS_DIR, filename)

    content = await file.read()
    async with aiofiles.open(filepath, "wb") as f:
        await f.write(content)

    media_type = "video" if ext in {".mp4", ".mov", ".avi"} else "image"
    tag_list = [t.strip() for t in tags.split(",") if t.strip()]

    doc = {
        "media_id": file_id,
        "filename": filename,
        "original_name": file.filename,
        "media_type": media_type,
        "url": f"/uploads/{filename}",
        "tags": tag_list,
        "size_bytes": len(content),
        "created_at": datetime.now(timezone.utc),
    }
    db = get_db()
    await db.media.insert_one(doc)
    doc.pop("_id", None)
    return doc


@app.get("/api/v1/media", tags=["Media Library"], summary="List media assets")
async def list_media(tag: Optional[str] = Query(None), media_type: Optional[str] = Query(None)):
    db = get_db()
    query: dict = {}
    if tag: query["tags"] = tag
    if media_type: query["media_type"] = media_type
    return await db.media.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)


@app.delete("/api/v1/media/{media_id}", tags=["Media Library"], summary="Delete a media asset")
async def delete_media(media_id: str):
    db = get_db()
    asset = await db.media.find_one({"media_id": media_id})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    filepath = os.path.join(UPLOADS_DIR, asset["filename"])
    if os.path.exists(filepath):
        os.remove(filepath)
    await db.media.delete_one({"media_id": media_id})
    return {"status": "deleted"}


@app.get("/api/v1/media/hashtag-groups", tags=["Media Library"], summary="List hashtag groups")
async def list_hashtag_groups():
    db = get_db()
    return await db.hashtag_groups.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)


@app.post("/api/v1/media/hashtag-groups", tags=["Media Library"], summary="Create a hashtag group")
async def create_hashtag_group(body: dict = Body(...)):
    db = get_db()
    doc = {
        "group_id": str(uuid.uuid4()),
        "name": body.get("name", ""),
        "hashtags": body.get("hashtags", []),
        "created_at": datetime.now(timezone.utc),
    }
    await db.hashtag_groups.insert_one(doc)
    doc.pop("_id", None)
    return doc


@app.patch("/api/v1/media/hashtag-groups/{group_id}", tags=["Media Library"], summary="Update a hashtag group")
async def update_hashtag_group(group_id: str, body: dict = Body(...)):
    db = get_db()
    update = {k: v for k, v in body.items() if k in {"name", "hashtags"}}
    result = await db.hashtag_groups.update_one({"group_id": group_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Group not found")
    return {"status": "updated"}


@app.delete("/api/v1/media/hashtag-groups/{group_id}", tags=["Media Library"], summary="Delete a hashtag group")
async def delete_hashtag_group(group_id: str):
    db = get_db()
    result = await db.hashtag_groups.delete_one({"group_id": group_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Group not found")
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# AI
# ---------------------------------------------------------------------------

@app.post("/api/v1/ai/caption", tags=["AI"], summary="Generate 3 caption drafts with Claude")
async def generate_caption(body: CaptionRequest):
    """
    Requires `ANTHROPIC_API_KEY`. Uses claude-sonnet-4-6.
    Pass `platform` for platform-optimised output (instagram/twitter/linkedin/facebook).
    """
    try:
        captions = await ai_module.generate_captions(body.prompt, body.platform, body.tone)
        # Log activity to DB
        db = get_db()
        await db.ai_activity.insert_one({
            "activity_id": str(uuid.uuid4()),
            "type": "caption",
            "prompt": body.prompt,
            "platform": body.platform,
            "tone": body.tone,
            "result": captions,
            "created_at": datetime.now(timezone.utc),
        })
        return {"captions": captions}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.post("/api/v1/ai/tag-message", tags=["AI"], summary="Classify inbox message with Claude Haiku")
async def tag_message(body: TagRequest):
    """
    Returns one of: Question | Complaint | Praise | Spam | Other.
    Requires `ANTHROPIC_API_KEY`.
    """
    try:
        tag = await ai_module.tag_inbox_message(body.content)
        return {"tag": tag}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


# ---------------------------------------------------------------------------
# Webhooks
# ---------------------------------------------------------------------------

@app.post("/api/v1/webhooks", tags=["Webhooks"], summary="Register a webhook")
async def create_webhook(body: WebhookCreate):
    db = get_db()
    doc = {
        "webhook_id": str(uuid.uuid4()),
        "url": body.url,
        "events": body.events,
        "created_at": datetime.now(timezone.utc),
        "is_active": True,
    }
    await db.webhooks.insert_one(doc)
    doc.pop("_id", None)
    return doc


@app.get("/api/v1/webhooks", tags=["Webhooks"], summary="List webhooks")
async def list_webhooks():
    db = get_db()
    return await db.webhooks.find({"is_active": True}, {"_id": 0}).to_list(100)


@app.delete("/api/v1/webhooks/{webhook_id}", tags=["Webhooks"], summary="Remove a webhook")
async def delete_webhook(webhook_id: str):
    db = get_db()
    result = await db.webhooks.update_one({"webhook_id": webhook_id}, {"$set": {"is_active": False}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# Thread & Extended Post Routes
# ---------------------------------------------------------------------------

@app.post("/api/v1/posts/thread", tags=["Posts"], summary="Create a thread (sequence of connected posts)")
async def create_thread_post(body: ThreadCreate):
    db = get_db()
    account = await db.accounts.find_one({"account_id": body.account_id, "is_active": True})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    thread_id = str(uuid.uuid4())
    docs = []
    for i, text in enumerate(body.tweets):
        media = body.media_urls[i] if i < len(body.media_urls) else []
        doc = {
            "post_id": str(uuid.uuid4()),
            "thread_id": thread_id,
            "thread_index": i,
            "platform": account["platform"],
            "account_id": body.account_id,
            "content": text,
            "media_urls": media,
            "status": "scheduled" if body.scheduled_at else "draft",
            "scheduled_at": body.scheduled_at,
            "published_at": None,
            "error_message": None,
            "platform_post_id": None,
            "pillar_id": None,
            "category_id": None,
            "tags": [],
            "metrics": {},
            "created_at": datetime.now(timezone.utc),
            "updated_at": None,
        }
        docs.append(doc)
    if docs:
        await db.posts.insert_many(docs)
    for d in docs:
        d.pop("_id", None)
    return {"thread_id": thread_id, "posts": docs}


@app.post("/api/v1/posts/bulk-csv", tags=["Posts"], summary="Bulk-create posts from a CSV file (headers: account_id, content, scheduled_at)")
async def bulk_csv_posts(file: UploadFile = File(...)):
    import csv as _csv, io
    content = (await file.read()).decode("utf-8-sig")
    reader = _csv.DictReader(io.StringIO(content))
    db = get_db()
    created, errors = [], []
    for i, row in enumerate(reader):
        try:
            account_id = row.get("account_id", "").strip()
            text = row.get("content", "").strip()
            scheduled_raw = row.get("scheduled_at", "").strip()
            if not text:
                errors.append({"row": i + 2, "error": "empty content"})
                continue
            account = None
            if account_id:
                account = await db.accounts.find_one({"account_id": account_id, "is_active": True})
            if not account:
                account = await db.accounts.find_one({"is_active": True})
            if not account:
                errors.append({"row": i + 2, "error": "no active account found"})
                continue
            scheduled_at = None
            if scheduled_raw:
                try:
                    scheduled_at = datetime.fromisoformat(scheduled_raw)
                except ValueError:
                    pass
            doc = {
                "post_id": str(uuid.uuid4()),
                "platform": account["platform"],
                "account_id": account["account_id"],
                "content": text,
                "media_urls": [],
                "status": "scheduled" if scheduled_at else "draft",
                "scheduled_at": scheduled_at,
                "published_at": None,
                "error_message": None,
                "platform_post_id": None,
                "pillar_id": None,
                "category_id": None,
                "tags": [],
                "metrics": {},
                "created_at": datetime.now(timezone.utc),
                "updated_at": None,
            }
            await db.posts.insert_one(doc)
            doc.pop("_id", None)
            created.append(doc)
        except Exception as e:
            errors.append({"row": i + 2, "error": str(e)})
    return {"created": len(created), "errors": errors}


@app.post("/api/v1/posts/{post_id}/clone", tags=["Posts"], summary="Clone a post as a new draft")
async def clone_post(post_id: str):
    db = get_db()
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    clone = {
        **post,
        "post_id": str(uuid.uuid4()),
        "status": "draft",
        "scheduled_at": None,
        "published_at": None,
        "error_message": None,
        "platform_post_id": None,
        "created_at": datetime.now(timezone.utc),
    }
    await db.posts.insert_one(clone)
    clone.pop("_id", None)
    return clone


@app.post("/api/v1/posts/{post_id}/retry", tags=["Posts"], summary="Retry a failed post")
async def retry_post(post_id: str):
    db = get_db()
    post = await db.posts.find_one({"post_id": post_id, "status": "failed"})
    if not post:
        raise HTTPException(status_code=404, detail="Failed post not found")
    await db.posts.update_one(
        {"post_id": post_id},
        {"$set": {"status": "scheduled", "error_message": None}},
    )
    return {"status": "queued", "post_id": post_id}


@app.post("/api/v1/posts/{post_id}/evergreen", tags=["Posts"], summary="Toggle evergreen recycling flag")
async def toggle_evergreen(post_id: str):
    db = get_db()
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    new_val = not post.get("is_evergreen", False)
    await db.posts.update_one({"post_id": post_id}, {"$set": {"is_evergreen": new_val}})
    return {"post_id": post_id, "is_evergreen": new_val}


# ---------------------------------------------------------------------------
# Queue Slots
# ---------------------------------------------------------------------------

@app.get("/api/v1/queue/slots", tags=["Scheduler"], summary="List queue time slots")
async def list_queue_slots():
    db = get_db()
    return await db.queue_slots.find({}, {"_id": 0}).sort("day_of_week", 1).to_list(200)


@app.post("/api/v1/queue/slots", tags=["Scheduler"], summary="Create a queue time slot")
async def create_queue_slot(body: QueueSlotCreate):
    db = get_db()
    doc = {
        "slot_id": str(uuid.uuid4()),
        "day_of_week": body.day_of_week,
        "hour": body.hour,
        "minute": body.minute,
        "platforms": body.platforms,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
    }
    await db.queue_slots.insert_one(doc)
    doc.pop("_id", None)
    return doc


@app.patch("/api/v1/queue/slots/{slot_id}", tags=["Scheduler"], summary="Update a queue time slot")
async def update_queue_slot(slot_id: str, body: dict = Body(...)):
    db = get_db()
    update = {k: v for k, v in body.items() if k in {"day_of_week", "hour", "minute", "platforms", "is_active"}}
    result = await db.queue_slots.update_one({"slot_id": slot_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Slot not found")
    return {"status": "updated"}


@app.delete("/api/v1/queue/slots/{slot_id}", tags=["Scheduler"], summary="Delete a queue time slot")
async def delete_queue_slot(slot_id: str):
    db = get_db()
    result = await db.queue_slots.delete_one({"slot_id": slot_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Slot not found")
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------

@app.get("/api/v1/categories", tags=["Categories"], summary="List content categories")
async def list_categories():
    db = get_db()
    return await db.categories.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)


@app.post("/api/v1/categories", tags=["Categories"], summary="Create a content category")
async def create_category(body: CategoryCreate):
    db = get_db()
    doc = {
        "category_id": str(uuid.uuid4()),
        "name": body.name,
        "color": body.color,
        "description": body.description,
        "created_at": datetime.now(timezone.utc),
    }
    await db.categories.insert_one(doc)
    doc.pop("_id", None)
    return doc


@app.delete("/api/v1/categories/{category_id}", tags=["Categories"], summary="Delete a content category")
async def delete_category(category_id: str):
    db = get_db()
    result = await db.categories.delete_one({"category_id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# Keyword Alerts
# ---------------------------------------------------------------------------

@app.get("/api/v1/alerts", tags=["Inbox"], summary="List keyword alerts")
async def list_alerts():
    db = get_db()
    return await db.alerts.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


@app.post("/api/v1/alerts", tags=["Inbox"], summary="Create a keyword alert")
async def create_alert(body: AlertCreate):
    db = get_db()
    doc = {
        "alert_id": str(uuid.uuid4()),
        "keyword": body.keyword.lower().strip(),
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
    }
    await db.alerts.insert_one(doc)
    doc.pop("_id", None)
    return doc


@app.delete("/api/v1/alerts/{alert_id}", tags=["Inbox"], summary="Delete a keyword alert")
async def delete_alert(alert_id: str):
    db = get_db()
    result = await db.alerts.delete_one({"alert_id": alert_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# Analytics (extended)
# ---------------------------------------------------------------------------

@app.get("/api/v1/analytics/heatmap", tags=["Analytics"], summary="Publishing frequency heatmap (day-of-week x hour)")
async def analytics_heatmap(days: int = Query(90, le=365)):
    db = get_db()
    start = datetime.now(timezone.utc) - timedelta(days=days)
    posts = await db.posts.find(
        {"status": "published", "published_at": {"$gte": start}},
        {"published_at": 1, "_id": 0},
    ).to_list(5000)
    grid = [[0] * 24 for _ in range(7)]
    for p in posts:
        pub = p.get("published_at")
        if not pub:
            continue
        if isinstance(pub, str):
            try:
                pub = datetime.fromisoformat(pub)
            except ValueError:
                continue
        if pub.tzinfo is None:
            pub = pub.replace(tzinfo=timezone.utc)
        grid[pub.weekday()][pub.hour] += 1
    return {
        "days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "hours": list(range(24)),
        "data": grid,
    }


# ---------------------------------------------------------------------------
# Brand Kit
# ---------------------------------------------------------------------------

@app.get("/api/v1/brand-kit", tags=["Media Library"], summary="Get brand kit")
async def get_brand_kit():
    db = get_db()
    kit = await db.brand_kit.find_one({}, {"_id": 0})
    return kit or {}


@app.put("/api/v1/brand-kit", tags=["Media Library"], summary="Update (upsert) brand kit")
async def update_brand_kit(body: dict = Body(...)):
    db = get_db()
    body.pop("_id", None)
    body["updated_at"] = datetime.now(timezone.utc)
    await db.brand_kit.update_one({}, {"$set": body}, upsert=True)
    return {"status": "updated"}


# ---------------------------------------------------------------------------
# Media (extended)
# ---------------------------------------------------------------------------

@app.get("/api/v1/media/unsplash", tags=["Media Library"], summary="Search Unsplash stock photos")
async def search_unsplash_photos(
    query: str = Query(...),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, le=30),
):
    import httpx as _httpx
    access_key = os.getenv("UNSPLASH_ACCESS_KEY", "")
    if not access_key:
        return {"results": [], "total": 0, "total_pages": 0, "error": "UNSPLASH_ACCESS_KEY not configured"}
    async with _httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            "https://api.unsplash.com/search/photos",
            params={"query": query, "page": page, "per_page": per_page},
            headers={"Authorization": f"Client-ID {access_key}"},
        )
        r.raise_for_status()
        data = r.json()
    photos = [
        {
            "id": p["id"],
            "url": p["urls"]["regular"],
            "thumb": p["urls"]["thumb"],
            "download_url": p["urls"]["full"],
            "description": p.get("description") or p.get("alt_description", ""),
            "photographer": p["user"]["name"],
            "photographer_url": p["user"]["links"]["html"],
            "width": p["width"],
            "height": p["height"],
        }
        for p in data.get("results", [])
    ]
    return {"results": photos, "total": data.get("total", 0), "total_pages": data.get("total_pages", 0)}


@app.post("/api/v1/media/{media_id}/auto-tag", tags=["Media Library"], summary="AI-generate tags for a media asset")
async def auto_tag_media(media_id: str):
    db = get_db()
    asset = await db.media.find_one({"media_id": media_id}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    url = asset.get("url", "")
    if url and not url.startswith("http"):
        url = f"{os.getenv('BACKEND_URL', 'http://localhost:8002')}{url}"
    try:
        new_tags = await ai_module.describe_image_tags(url)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    merged = list({*asset.get("tags", []), *new_tags})
    await db.media.update_one({"media_id": media_id}, {"$set": {"tags": merged}})
    return {"media_id": media_id, "tags": merged}


# ---------------------------------------------------------------------------
# AI (extended)
# ---------------------------------------------------------------------------

@app.post("/api/v1/ai/sentiment", tags=["AI"], summary="Classify message sentiment (positive/negative/neutral)")
async def analyze_sentiment_endpoint(body: TagRequest):
    try:
        sentiment = await ai_module.analyze_sentiment(body.content)
        return {"sentiment": sentiment}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


# ---------------------------------------------------------------------------
# AI — Repurpose
# ---------------------------------------------------------------------------

class RepurposeRequest(BaseModel):
    content: str = Field(..., description="The original post text to reformat")
    source_platform: str = Field("linkedin", description="Platform the content was written for")
    target_platforms: list[str] = Field(
        ["twitter", "instagram", "tiktok"],
        description="Platforms to reformat the content for. Supported: twitter, instagram, linkedin, tiktok, facebook, youtube",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "content": "Most engineers fail system design interviews not because they lack knowledge — but because they don't have a framework. Here are the 5 steps I teach...",
                "source_platform": "linkedin",
                "target_platforms": ["twitter", "tiktok", "instagram"],
            }
        }
    }


@app.post("/api/v1/ai/repurpose", tags=["AI"], summary="Reformat a post for multiple platforms using AI")
async def repurpose_post(body: RepurposeRequest):
    """
    Takes content written for one platform and returns AI-reformatted versions
    optimised for each requested target platform.
    """
    try:
        results = await ai_module.repurpose_content(
            body.content, body.source_platform, body.target_platforms
        )
        # Log activity to DB
        db = get_db()
        await db.ai_activity.insert_one({
            "activity_id": str(uuid.uuid4()),
            "type": "repurpose",
            "source_platform": body.source_platform,
            "target_platforms": body.target_platforms,
            "original_content": body.content,
            "result": results,
            "created_at": datetime.now(timezone.utc),
        })
        return {"repurposed": results}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


# ---------------------------------------------------------------------------
# LinkedIn Carousel
# ---------------------------------------------------------------------------

class CarouselSlide(BaseModel):
    title: str = Field(..., description="Slide headline — rendered at 26pt bold")
    body: str = Field(..., description="Slide body text — rendered at 14pt")
    bg_color: str = Field("#1e293b", description="Hex background colour for this slide")
    text_color: str = Field("#ffffff", description="Hex text colour for this slide")
    is_cta: bool = Field(False, description="If true, adds a 'Practice free → systemdesignlab.io' CTA bar")


class CarouselCreate(BaseModel):
    account_id: str = Field(..., description="LinkedIn account_id to post to (carousel is LinkedIn-only)")
    slides: list[CarouselSlide] = Field(..., min_length=2, max_length=20, description="2–20 slides; first is the hook, last should be CTA")
    scheduled_at: Optional[datetime] = Field(None, description="ISO 8601 publish time — omit to save as draft")

    model_config = {
        "json_schema_extra": {
            "example": {
                "account_id": "acc_abc123",
                "slides": [
                    {"title": "5 System Design Patterns Every L5 Engineer Must Know", "body": "Swipe to learn each one →", "bg_color": "#1e293b", "is_cta": False},
                    {"title": "1. CQRS", "body": "Separate read and write models. Reads get their own optimised store.", "bg_color": "#0f172a", "is_cta": False},
                    {"title": "Practice them all free", "body": "systemdesignlab.io — AI feedback on every answer", "bg_color": "#7c3aed", "is_cta": True},
                ],
                "scheduled_at": "2026-06-01T09:00:00Z",
            }
        }
    }


@app.post("/api/v1/posts/carousel", tags=["Posts"], summary="Create a LinkedIn carousel post (PDF document)")
async def create_carousel_post(body: CarouselCreate):
    """
    Renders slides as a PDF using fpdf2 and creates a post document.
    The PDF is stored as a media asset and scheduled for LinkedIn upload.
    """
    db = get_db()
    account = await db.accounts.find_one({"account_id": body.account_id, "is_active": True})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if account["platform"] != "linkedin":
        raise HTTPException(status_code=400, detail="Carousel posts are only supported on LinkedIn")
    if len(body.slides) < 2:
        raise HTTPException(status_code=400, detail="Carousel requires at least 2 slides")

    # Generate PDF
    try:
        from fpdf import FPDF

        class CarouselPDF(FPDF):
            pass

        pdf = CarouselPDF(orientation="P", unit="mm", format=(210, 265))
        pdf.set_auto_page_break(False)

        def hex_to_rgb(hex_color: str):
            h = hex_color.lstrip("#")
            if len(h) == 3:
                h = "".join(c * 2 for c in h)
            return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

        for i, slide in enumerate(body.slides):
            pdf.add_page()
            bg = hex_to_rgb(slide.bg_color)
            pdf.set_fill_color(*bg)
            pdf.rect(0, 0, 210, 265, "F")

            tc = hex_to_rgb(slide.text_color)

            # Slide number
            pdf.set_font("Helvetica", size=9)
            pdf.set_text_color(tc[0], tc[1], tc[2])
            pdf.set_xy(15, 15)
            pdf.set_text_color(tc[0], tc[1], tc[2])
            pdf.cell(0, 8, f"{i + 1} / {len(body.slides)}", ln=True)

            # Title
            pdf.set_font("Helvetica", "B", size=26)
            pdf.set_text_color(tc[0], tc[1], tc[2])
            pdf.set_xy(15, 40)
            pdf.multi_cell(180, 12, slide.title, align="L")

            # Body
            pdf.set_font("Helvetica", size=14)
            pdf.set_text_color(tc[0], tc[1], tc[2])
            y_after_title = min(pdf.get_y() + 10, 150)
            pdf.set_xy(15, y_after_title)
            pdf.multi_cell(180, 8, slide.body, align="L")

            # CTA bar
            if slide.is_cta:
                pdf.set_fill_color(255, 255, 255)
                pdf.set_xy(15, 225)
                pdf.set_fill_color(255, 255, 255)
                # semi-transparent overlay approximation
                pdf.set_font("Helvetica", "B", size=13)
                pdf.set_text_color(tc[0], tc[1], tc[2])
                pdf.cell(180, 12, "Practice free → systemdesignlab.io", ln=True, align="C")

            # Branding footer
            pdf.set_font("Helvetica", "B", size=10)
            pdf.set_text_color(tc[0], tc[1], tc[2])
            pdf.set_xy(15, 252)
            pdf.cell(0, 8, "SystemDesignLab", align="L")

        file_id = str(uuid.uuid4())
        pdf_filename = f"{file_id}.pdf"
        pdf_path = os.path.join(UPLOADS_DIR, pdf_filename)
        pdf.output(pdf_path)

    except ImportError:
        raise HTTPException(status_code=503, detail="fpdf2 not installed — run: pip install fpdf2")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {exc}")

    # Save as media asset
    pdf_size = os.path.getsize(pdf_path)
    media_doc = {
        "media_id": file_id,
        "filename": pdf_filename,
        "original_name": "carousel.pdf",
        "media_type": "document",
        "url": f"/uploads/{pdf_filename}",
        "tags": ["carousel", "linkedin"],
        "size_bytes": pdf_size,
        "created_at": datetime.now(timezone.utc),
    }
    await db.media.insert_one(media_doc)

    # Create post document
    post_doc = {
        "post_id": str(uuid.uuid4()),
        "platform": "linkedin",
        "account_id": body.account_id,
        "content": body.slides[0].title,
        "media_urls": [f"/uploads/{pdf_filename}"],
        "post_type": "carousel",
        "carousel_slides": len(body.slides),
        "status": "scheduled" if body.scheduled_at else "draft",
        "scheduled_at": body.scheduled_at,
        "published_at": None,
        "error_message": None,
        "platform_post_id": None,
        "pillar_id": None,
        "category_id": None,
        "tags": ["carousel"],
        "metrics": {},
        "created_at": datetime.now(timezone.utc),
        "updated_at": None,
    }
    await db.posts.insert_one(post_doc)
    post_doc.pop("_id", None)
    return post_doc


# ---------------------------------------------------------------------------
# Content Pillars
# ---------------------------------------------------------------------------

DEFAULT_PILLARS = [
    {
        "name": "System Design Education",
        "description": "Teach the thing we help people practice — design breakdowns, caching, sharding, concurrency.",
        "color": "#8b5cf6",
        "icon": "BookOpen",
        "example": "How would you design Uber's location tracking?",
        "is_default": True,
    },
    {
        "name": "Interview Prep Tactics",
        "description": "Help them ace the process — how to structure a 45-min round, what interviewers look for.",
        "color": "#0A66C2",
        "icon": "Briefcase",
        "example": "Red flags that tank good system design candidates",
        "is_default": True,
    },
    {
        "name": "Career & Leveling Up",
        "description": "Talk to the ambition behind why they prep — L5→L6 stories, salary negotiation, FAANG levels.",
        "color": "#10b981",
        "icon": "TrendingUp",
        "example": "How I got my L6 at Amazon — what I changed",
        "is_default": True,
    },
    {
        "name": "Behind the Product",
        "description": "Build trust by being transparent — how AI feedback works, new features, founder updates.",
        "color": "#f59e0b",
        "icon": "Lightbulb",
        "example": "How our AI evaluates your system design answer",
        "is_default": True,
    },
    {
        "name": "Social Proof & Community",
        "description": "Let users sell for us — win posts, AI feedback screenshots, leaderboard, polls.",
        "color": "#ef4444",
        "icon": "Heart",
        "example": "Just got an offer at Google — SystemDesignLab helped me",
        "is_default": True,
    },
]


class PillarCreate(BaseModel):
    name: str = Field(..., description="Short pillar label, e.g. 'Behind the Build'")
    description: str = Field("", description="1–2 sentence explanation of what posts belong here")
    color: str = Field("#8b5cf6", description="Hex accent colour shown on the pillar card")
    icon: str = Field("BookOpen", description="Lucide icon name rendered on the card")
    example: str = Field("", description="Example post idea to guide content creation")

    model_config = {
        "json_schema_extra": {
            "example": {
                "name": "Founder Lessons",
                "description": "Raw, honest takes on building in public — mistakes, pivots, and wins.",
                "color": "#f59e0b",
                "icon": "Lightbulb",
                "example": "We killed a feature 300 users loved. Here's why.",
            }
        }
    }


async def _ensure_default_pillars(db):
    count = await db.pillars.count_documents({})
    if count == 0:
        for p in DEFAULT_PILLARS:
            await db.pillars.insert_one({
                "pillar_id": str(uuid.uuid4()),
                **p,
                "created_at": datetime.now(timezone.utc),
            })


@app.get("/api/v1/pillars", tags=["Content Pillars"], summary="List content pillars with post counts")
async def list_pillars():
    """
    Returns all content pillars with a `post_counts` map showing how many published posts
    are tagged to each pillar. Five default SDL pillars are seeded automatically on the
    first call if the collection is empty.
    """
    db = get_db()
    await _ensure_default_pillars(db)
    pillars = await db.pillars.find({}, {"_id": 0}).sort("created_at", 1).to_list(50)
    post_counts = {}
    for p in pillars:
        pid = p["pillar_id"]
        post_counts[pid] = await db.posts.count_documents({"pillar_id": pid})
    return {"pillars": pillars, "post_counts": post_counts}


@app.post("/api/v1/pillars", tags=["Content Pillars"], summary="Create a custom content pillar")
async def create_pillar(body: PillarCreate):
    """
    Creates a user-defined pillar. `is_default` is always set to `false` for custom pillars.
    Custom pillars can be deleted; the 5 built-in defaults cannot.
    """
    db = get_db()
    doc = {
        "pillar_id": str(uuid.uuid4()),
        "name": body.name,
        "description": body.description,
        "color": body.color,
        "icon": body.icon,
        "example": body.example,
        "is_default": False,
        "created_at": datetime.now(timezone.utc),
    }
    await db.pillars.insert_one(doc)
    doc.pop("_id", None)
    return doc


@app.delete("/api/v1/pillars/{pillar_id}", tags=["Content Pillars"], summary="Delete a custom pillar")
async def delete_pillar(pillar_id: str):
    db = get_db()
    pillar = await db.pillars.find_one({"pillar_id": pillar_id})
    if not pillar:
        raise HTTPException(status_code=404, detail="Pillar not found")
    if pillar.get("is_default"):
        raise HTTPException(status_code=400, detail="Cannot delete default pillars")
    await db.pillars.delete_one({"pillar_id": pillar_id})
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# SMART Goals
# ---------------------------------------------------------------------------

class GoalCreate(BaseModel):
    metric: Literal["followers", "engagement_rate", "posts_per_week", "trial_signups", "website_sessions"] = Field(
        ..., description="The metric being tracked"
    )
    platform: str = Field(..., description="Platform this goal applies to (linkedin, twitter, youtube, tiktok, instagram, all)")
    target: float = Field(..., description="Target value to reach by the deadline")
    current_value: float = Field(0, description="Current measured value — update regularly with PATCH")
    deadline: Optional[datetime] = Field(None, description="ISO 8601 deadline for reaching the target")

    model_config = {
        "json_schema_extra": {
            "example": {
                "metric": "followers",
                "platform": "linkedin",
                "target": 2000,
                "current_value": 124,
                "deadline": "2026-08-29T00:00:00Z",
            }
        }
    }


@app.get("/api/v1/goals", tags=["Goals"], summary="List SMART goals")
async def list_goals():
    """
    Returns all SMART goals sorted newest-first.
    Each goal has a `metric` (followers | engagement_rate | posts_per_week | trial_signups | website_sessions),
    a `target`, a `current_value`, and an optional `deadline`.
    """
    db = get_db()
    return await db.goals.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)


@app.post("/api/v1/goals", tags=["Goals"], summary="Create a SMART goal")
async def create_goal(body: GoalCreate):
    db = get_db()
    doc = {
        "goal_id": str(uuid.uuid4()),
        "metric": body.metric,
        "platform": body.platform,
        "target": body.target,
        "current_value": body.current_value,
        "deadline": body.deadline,
        "created_at": datetime.now(timezone.utc),
    }
    await db.goals.insert_one(doc)
    doc.pop("_id", None)
    return doc


@app.patch("/api/v1/goals/{goal_id}", tags=["Goals"], summary="Update goal progress")
async def update_goal(goal_id: str, body: dict = Body(..., example={"current_value": 450, "target": 2000})):
    db = get_db()
    update = {k: v for k, v in body.items() if k in {"current_value", "target", "deadline"}}
    update["updated_at"] = datetime.now(timezone.utc)
    result = await db.goals.update_one({"goal_id": goal_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Goal not found")
    return {"status": "updated"}


@app.delete("/api/v1/goals/{goal_id}", tags=["Goals"], summary="Delete a goal")
async def delete_goal(goal_id: str):
    db = get_db()
    result = await db.goals.delete_one({"goal_id": goal_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Goal not found")
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# Follower Growth Snapshots
# ---------------------------------------------------------------------------

@app.post("/api/v1/accounts/snapshot-followers", tags=["Analytics"], summary="Save a follower count snapshot for all accounts")
async def snapshot_followers():
    """
    Reads the current `followers_count` from every active account and writes a timestamped
    record to the `follower_snapshots` collection. Call this on a schedule (e.g. daily)
    to build a time-series that powers the Follower Growth chart.

    Returns the number of snapshots saved and the snapshot timestamp.
    """
    db = get_db()
    accounts = await db.accounts.find({"is_active": True}, {"_id": 0}).to_list(200)
    now = datetime.now(timezone.utc)
    inserted = 0
    for acc in accounts:
        doc = {
            "snapshot_id": str(uuid.uuid4()),
            "account_id": acc["account_id"],
            "platform": acc["platform"],
            "username": acc.get("username", ""),
            "followers_count": acc.get("followers_count", 0),
            "snapped_at": now,
        }
        await db.follower_snapshots.insert_one(doc)
        inserted += 1
    return {"snapshots_saved": inserted, "snapped_at": now.isoformat()}


@app.get("/api/v1/analytics/follower-growth", tags=["Analytics"], summary="Follower growth over time per platform")
async def follower_growth(days: int = Query(30, le=365)):
    """
    Returns a time-series of follower counts grouped by platform for the last `days` days
    (max 365), plus `current_totals` from live account records.

    Each platform series is an array of `{ date: "YYYY-MM-DD", followers: N }` objects
    sorted chronologically. Only dates with snapshots appear — call
    `POST /api/v1/accounts/snapshot-followers` to populate the history.
    """
    db = get_db()
    start = datetime.now(timezone.utc) - timedelta(days=days)
    snapshots = await db.follower_snapshots.find(
        {"snapped_at": {"$gte": start}},
        {"_id": 0, "platform": 1, "followers_count": 1, "snapped_at": 1, "account_id": 1},
    ).sort("snapped_at", 1).to_list(5000)

    # Group by date + platform
    by_platform: dict = {}
    for snap in snapshots:
        plat = snap["platform"]
        d = snap["snapped_at"].strftime("%Y-%m-%d") if hasattr(snap["snapped_at"], "strftime") else str(snap["snapped_at"])[:10]
        if plat not in by_platform:
            by_platform[plat] = {}
        # Keep max for the day
        if d not in by_platform[plat] or snap["followers_count"] > by_platform[plat][d]:
            by_platform[plat][d] = snap["followers_count"]

    # Convert to sorted series
    result = {}
    for plat, date_map in by_platform.items():
        result[plat] = [{"date": d, "followers": v} for d, v in sorted(date_map.items())]

    # Also return current totals from accounts
    accounts = await db.accounts.find({"is_active": True}, {"_id": 0, "platform": 1, "followers_count": 1}).to_list(200)
    totals: dict = {}
    for acc in accounts:
        plat = acc["platform"]
        totals[plat] = totals.get(plat, 0) + (acc.get("followers_count") or 0)

    return {"series": result, "current_totals": totals}


# ---------------------------------------------------------------------------
# Real Engagement Metrics Refresh
# ---------------------------------------------------------------------------

@app.post("/api/v1/posts/{post_id}/refresh-metrics", tags=["Posts"], summary="Pull latest engagement metrics from the platform API")
async def refresh_post_metrics(post_id: str):
    """
    Calls the originating platform's API to fetch up-to-date engagement numbers
    (likes, comments, shares, reach/impressions) and writes them to `posts.metrics`.

    Supported platforms: **Twitter/X** (v2 public metrics), **LinkedIn** (Social Metadata API),
    **YouTube** (Data API v3 statistics). Instagram and TikTok return `skipped` — use
    webhook-based metric updates for those platforms instead.

    Returns `{ status, metrics }` where `status` is one of `updated | skipped | error`.
    """
    db = get_db()
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.get("status") != "published":
        return {"status": "skipped", "reason": "Post not published yet"}

    account = await db.accounts.find_one({"account_id": post.get("account_id")}, {"_id": 0})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    platform = post.get("platform")
    platform_post_id = post.get("platform_post_id")
    if not platform_post_id:
        return {"status": "skipped", "reason": "No platform_post_id stored"}

    metrics: dict = {}
    try:
        if platform == "twitter":
            raw = await twitter_platform.get_tweet_metrics(platform_post_id, account["access_token"])
            pm = raw.get("public_metrics", {})
            metrics = {
                "likes": pm.get("like_count", 0),
                "comments": pm.get("reply_count", 0),
                "shares": pm.get("retweet_count", 0),
                "reach": pm.get("impression_count", 0),
            }
        elif platform == "youtube":
            raw = await youtube_platform.get_video_metrics(platform_post_id, account["access_token"])
            metrics = raw
        elif platform == "linkedin":
            raw = await linkedin_platform.get_post_stats(platform_post_id, account["access_token"])
            reactions = raw.get("totalSocialActivityCounts", {})
            metrics = {
                "likes": reactions.get("numLikes", 0),
                "comments": reactions.get("numComments", 0),
                "shares": reactions.get("numShares", 0),
                "reach": reactions.get("numImpressions", 0),
            }
    except Exception as exc:
        return {"status": "error", "detail": str(exc)}

    if metrics:
        await db.posts.update_one(
            {"post_id": post_id},
            {"$set": {"metrics": metrics, "metrics_refreshed_at": datetime.now(timezone.utc)}},
        )

    return {"status": "updated", "metrics": metrics}


# ---------------------------------------------------------------------------
# 90-Day Plan Checklist
# ---------------------------------------------------------------------------

CHECKLIST_SEED = [
    # Days 1–14
    {"phase": "Days 1–14", "text": "Audit all existing social profiles — completeness, bio, links", "note": "Check LinkedIn, Twitter, TikTok, Instagram"},
    {"phase": "Days 1–14", "text": "Rewrite LinkedIn bio: include 'system design interview prep', 'AI-powered feedback'", "note": None},
    {"phase": "Days 1–14", "text": "Connect all accounts in Socails (LinkedIn + Twitter minimum)"},
    {"phase": "Days 1–14", "text": "Set up UTM parameters for all links to track in GA4", "link": "/utm"},
    {"phase": "Days 1–14", "text": "Install Google Analytics, track /trial and /signup as conversion goals"},
    {"phase": "Days 1–14", "text": "Create a content swipe file: 20 post ideas mapped to pillars", "link": "/pillars"},
    {"phase": "Days 1–14", "text": "Set up 90-day SMART goals (followers, engagement rate, signups)", "link": "/goals"},
    {"phase": "Days 1–14", "text": "Write and schedule first 2 weeks: 6 LinkedIn posts + 10 tweets"},
    # Days 15–30
    {"phase": "Days 15–30", "text": "Post consistently: 3x/week LinkedIn, 1x/day Twitter"},
    {"phase": "Days 15–30", "text": "Reply to every comment within 24 hours (boosts engagement 30%)"},
    {"phase": "Days 15–30", "text": "Comment on 5 community posts per day (r/cscareerquestions, Blind)"},
    {"phase": "Days 15–30", "text": "Launch first LinkedIn poll: 'What's hardest in system design interviews?'"},
    {"phase": "Days 15–30", "text": "Publish first LinkedIn carousel: '10 system design patterns — visual guide'", "link": "/carousel"},
    {"phase": "Days 15–30", "text": "Analyse: which of the first 10 posts drove the most profile visits?", "link": "/analytics"},
    # Days 31–60
    {"phase": "Days 31–60", "text": "Identify top 2 performing content types — produce 2x more of them"},
    {"phase": "Days 31–60", "text": "Start repurposing: turn best LinkedIn post into a Twitter thread"},
    {"phase": "Days 31–60", "text": "Add TikTok OR YouTube (whichever has more traction)"},
    {"phase": "Days 31–60", "text": "Post first 'social proof' piece (user win, AI feedback screenshot with permission)"},
    {"phase": "Days 31–60", "text": "Reach out to 5 engineers with audiences — offer free access for honest review"},
    {"phase": "Days 31–60", "text": "Launch LinkedIn Newsletter: 'The System Design Digest' (biweekly)"},
    # Days 61–90
    {"phase": "Days 61–90", "text": "Review UTM data: which platform + post drove actual signups?", "link": "/utm"},
    {"phase": "Days 61–90", "text": "Double budget/effort on highest-converting channel"},
    {"phase": "Days 61–90", "text": "A/B test two CTA styles: 'Try for free' vs 'Practice your first question'"},
    {"phase": "Days 61–90", "text": "Create a 'user success story' series (1 per month minimum)"},
    {"phase": "Days 61–90", "text": "Build email list from social: newsletter + lead magnet"},
    {"phase": "Days 61–90", "text": "Create lead magnet: 'Free system design interview checklist' PDF → email capture"},
]


async def _seed_checklist(db):
    count = await db.plan_checklist.count_documents({})
    if count == 0:
        for item in CHECKLIST_SEED:
            await db.plan_checklist.insert_one({
                "item_id": str(uuid.uuid4()),
                "phase": item["phase"],
                "text": item["text"],
                "note": item.get("note"),
                "link": item.get("link"),
                "completed": False,
                "created_at": datetime.now(timezone.utc),
            })


@app.get("/api/v1/plan/checklist", tags=["90-Day Plan"], summary="Get the 90-day marketing plan checklist")
async def get_checklist():
    """
    Returns 26 checklist items across four phases, seeded from Buffer's research on what
    drives 0→2,000 follower growth in 90 days for a B2B SaaS product.

    Phases: **Days 1–14** (foundations, 8 items) · **Days 15–30** (consistency, 6 items) ·
    **Days 31–60** (amplification, 6 items) · **Days 61–90** (conversion, 6 items).

    Items are seeded on first call. Each item has `completed` (bool), optional `note`, and
    optional `link` pointing to the relevant Socails page.
    """
    db = get_db()
    await _seed_checklist(db)
    order = {"Days 1–14": 0, "Days 15–30": 1, "Days 31–60": 2, "Days 61–90": 3}
    items = await db.plan_checklist.find({}, {"_id": 0}).to_list(200)
    items.sort(key=lambda x: (order.get(x.get("phase", ""), 99), x.get("created_at", "")))
    return items


@app.patch("/api/v1/plan/checklist/{item_id}", tags=["90-Day Plan"], summary="Toggle a checklist item")
async def update_checklist_item(item_id: str, body: dict = Body(..., example={"completed": True})):
    """
    Sets `completed` and writes a `completed_at` ISO timestamp when marking done,
    or clears `completed_at` when unchecking. Both fields are persisted to MongoDB.
    """
    db = get_db()
    completed = body.get("completed", False)
    update: dict = {
        "completed": completed,
        "completed_at": datetime.now(timezone.utc).isoformat() if completed else None,
    }
    result = await db.plan_checklist.update_one({"item_id": item_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")

    # Auto-set plan start date on first completion
    if completed:
        meta = await db.plan_meta.find_one({})
        if not meta:
            await db.plan_meta.insert_one({
                "started_at": datetime.now(timezone.utc).isoformat(),
                "created_at": datetime.now(timezone.utc),
            })

    return {"status": "updated", "completed_at": update["completed_at"]}


@app.post("/api/v1/plan/checklist/reset", tags=["90-Day Plan"], summary="Reset checklist to all uncompleted")
async def reset_checklist():
    """
    Marks all 26 checklist items as `completed: false` and clears all `completed_at`
    timestamps. Also deletes the plan start date so the 90-day clock resets.
    """
    db = get_db()
    await db.plan_checklist.update_many({}, {"$set": {"completed": False, "completed_at": None}})
    await db.plan_meta.delete_many({})
    return {"status": "reset"}


@app.get("/api/v1/plan/meta", tags=["90-Day Plan"], summary="Get plan start date and current day counter")
async def get_plan_meta():
    """
    Returns the plan start date and derived fields:
    - `started_at` — ISO string when the first item was completed (or manually set)
    - `current_day` — how many days since start (1-indexed, capped at 90)
    - `days_remaining` — days left until day 90
    - `on_track` — whether current completions match expected pace

    Returns `{ started_at: null }` if the plan hasn't been started yet.
    """
    db = get_db()
    meta = await db.plan_meta.find_one({}, {"_id": 0})
    if not meta or not meta.get("started_at"):
        return {"started_at": None, "current_day": None, "days_remaining": None, "on_track": None}

    started = datetime.fromisoformat(meta["started_at"].replace("Z", "+00:00")) if isinstance(meta["started_at"], str) else meta["started_at"]
    now = datetime.now(timezone.utc)
    delta = (now - started).days + 1  # day 1 on start date
    current_day = min(delta, 90)
    days_remaining = max(0, 90 - delta)

    # Count completed items
    done = await db.plan_checklist.count_documents({"completed": True})
    total = await db.plan_checklist.count_documents({})
    expected = round((current_day / 90) * total) if total else 0
    on_track = done >= expected

    return {
        "started_at": meta["started_at"],
        "current_day": current_day,
        "days_remaining": days_remaining,
        "total_done": done,
        "total_items": total,
        "on_track": on_track,
    }


@app.post("/api/v1/plan/start", tags=["90-Day Plan"], summary="Manually set the plan start date")
async def start_plan(body: dict = Body(..., example={"started_at": "2026-05-29T00:00:00Z"})):
    """
    Explicitly sets the 90-day plan start date. If omitted, `started_at` defaults to now.
    Overwrites any existing start date.
    """
    db = get_db()
    started_at = body.get("started_at") or datetime.now(timezone.utc).isoformat()
    await db.plan_meta.delete_many({})
    await db.plan_meta.insert_one({
        "started_at": started_at,
        "created_at": datetime.now(timezone.utc),
    })
    return {"status": "started", "started_at": started_at}


# ---------------------------------------------------------------------------
# Scalar API Docs
# ---------------------------------------------------------------------------

@app.get("/api/docs", include_in_schema=False)
async def scalar_docs():
    return HTMLResponse("""<!doctype html>
<html>
  <head>
    <title>Socails API Reference</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>body{margin:0}</style>
  </head>
  <body>
    <script id="api-reference"></script>
    <script>
      document.getElementById('api-reference').dataset.configuration = JSON.stringify({
        spec: { url: '/openapi.json' },
        theme: 'purple',
        layout: 'modern',
        defaultHttpClient: { targetKey: 'python', clientKey: 'requests' },
        showSidebar: true
      });
    </script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>""")
