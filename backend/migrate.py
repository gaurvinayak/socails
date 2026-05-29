"""
migrate.py — backfill missing fields and fix data-integrity issues on
             existing MongoDB documents.

Every operation is IDEMPOTENT — safe to run multiple times.
Uses $exists checks so already-correct documents are never touched.

Run manually:
    cd backend
    python migrate.py

Also called automatically from server.py lifespan on every startup
(runs as a background task so it never blocks the server).
"""
import asyncio
import os
import logging
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger("migrate")

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME   = os.getenv("DB_NAME",   "socails")


# ── helpers ───────────────────────────────────────────────────────────────────

def _info(collection: str, field: str, n: int):
    if n:
        log.info("  %-20s %-30s %d docs patched", collection, field, n)


async def _add(db, collection: str, field: str, default):
    """Add a field with a default value to every document that is missing it."""
    col = db[collection]
    r = await col.update_many(
        {field: {"$exists": False}},
        {"$set": {field: default}},
    )
    _info(collection, field, r.modified_count)
    return r.modified_count


# ── migration ─────────────────────────────────────────────────────────────────

async def run(db=None) -> dict:
    """
    Run all migrations against `db`.
    If `db` is None a fresh Motor client is created (standalone mode).
    Returns a summary dict {collection: fields_patched}.
    """
    standalone = db is None
    client = None
    if standalone:
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]

    summary: dict = {}

    try:
        log.info("── migrate: starting ────────────────────────────────────────")

        # ── posts ─────────────────────────────────────────────────────────

        log.info("  collection: posts")
        n = 0

        # Fields added in DB audit
        n += await _add(db, "posts", "pillar_id",            None)
        n += await _add(db, "posts", "category_id",          None)
        n += await _add(db, "posts", "tags",                 [])
        n += await _add(db, "posts", "metrics",              {})
        n += await _add(db, "posts", "updated_at",           None)

        # Fields added when poll support was added
        n += await _add(db, "posts", "post_type",            None)
        n += await _add(db, "posts", "poll_options",         [])
        n += await _add(db, "posts", "poll_duration_minutes",None)

        # Fields needed for evergreen recycling
        n += await _add(db, "posts", "is_evergreen",         False)

        # Fields always expected on a post document
        n += await _add(db, "posts", "error_message",        None)
        n += await _add(db, "posts", "platform_post_id",     None)
        n += await _add(db, "posts", "published_at",         None)
        n += await _add(db, "posts", "media_urls",           [])

        # ── Set post_type="thread_tweet" for posts that belong to a thread ──
        r = await db.posts.update_many(
            {"thread_id": {"$exists": True}, "post_type": None},
            {"$set": {"post_type": "thread_tweet"}},
        )
        _info("posts", "post_type=thread_tweet (inferred)", r.modified_count)
        n += r.modified_count

        # ── Detect carousel: multi-image posts with no post_type ────────────
        r = await db.posts.update_many(
            {
                "post_type": None,
                "$expr": {"$gt": [{"$size": {"$ifNull": ["$media_urls", []]}}, 1]},
            },
            {"$set": {"post_type": "carousel"}},
        )
        _info("posts", "post_type=carousel (inferred)", r.modified_count)
        n += r.modified_count

        # ── Fix TikTok/YouTube posts silently marked "published" ─────────────
        # Before the bug fix, publish_post() had no tiktok/youtube branch so
        # it fell through to the update_one that set status="published" even
        # though nothing was ever sent to the platform.
        r = await db.posts.update_many(
            {
                "platform":         {"$in": ["tiktok", "youtube"]},
                "status":           "published",
                "platform_post_id": None,
            },
            {
                "$set": {
                    "status":        "failed",
                    "error_message": (
                        "Post was never actually published — "
                        "TikTok/YouTube publishing was not implemented at the time. "
                        "Please reschedule."
                    ),
                }
            },
        )
        _info("posts", "tiktok/youtube fake-published → failed", r.modified_count)
        n += r.modified_count

        summary["posts"] = n

        # ── accounts ──────────────────────────────────────────────────────

        log.info("  collection: accounts")
        n = 0
        n += await _add(db, "accounts", "followers_count",   0)
        n += await _add(db, "accounts", "token_expires_at",  None)
        n += await _add(db, "accounts", "refresh_token",     None)
        n += await _add(db, "accounts", "scopes",            [])
        n += await _add(db, "accounts", "profile_image_url", "")
        n += await _add(db, "accounts", "display_name",      "")
        n += await _add(db, "accounts", "is_active",         True)
        summary["accounts"] = n

        # ── inbox_items ────────────────────────────────────────────────────

        log.info("  collection: inbox_items")
        n = 0
        n += await _add(db, "inbox_items", "sentiment",    None)
        n += await _add(db, "inbox_items", "tags",         [])
        n += await _add(db, "inbox_items", "replies",      [])
        n += await _add(db, "inbox_items", "replied_at",   None)
        n += await _add(db, "inbox_items", "assigned_to",  None)
        summary["inbox_items"] = n

        # ── plan_checklist ─────────────────────────────────────────────────

        log.info("  collection: plan_checklist")
        n = 0
        n += await _add(db, "plan_checklist", "completed",    False)
        n += await _add(db, "plan_checklist", "completed_at", None)
        summary["plan_checklist"] = n

        # ── queue_slots ────────────────────────────────────────────────────

        log.info("  collection: queue_slots")
        n = 0
        n += await _add(db, "queue_slots", "is_active",  True)
        n += await _add(db, "queue_slots", "platforms",  [])
        summary["queue_slots"] = n

        # ── goals ──────────────────────────────────────────────────────────

        log.info("  collection: goals")
        n = 0
        n += await _add(db, "goals", "updated_at",     None)
        n += await _add(db, "goals", "current_value",  0)
        summary["goals"] = n

        # ── hashtag_groups ─────────────────────────────────────────────────

        log.info("  collection: hashtag_groups")
        n = 0
        n += await _add(db, "hashtag_groups", "hashtags",   [])
        n += await _add(db, "hashtag_groups", "created_at", datetime.now(timezone.utc))
        summary["hashtag_groups"] = n

        # ── media ──────────────────────────────────────────────────────────

        log.info("  collection: media")
        n = 0
        n += await _add(db, "media", "tags",       [])
        n += await _add(db, "media", "alt_text",   "")
        n += await _add(db, "media", "file_size",  0)
        summary["media"] = n

        total = sum(summary.values())
        log.info(
            "── migrate: done — %d documents patched across %d collections ──",
            total, len(summary),
        )

    finally:
        if standalone and client:
            client.close()

    return summary


if __name__ == "__main__":
    # Load .env when running standalone
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass  # python-dotenv not installed — rely on env vars already set

    asyncio.run(run())
