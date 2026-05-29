"""
APScheduler background jobs (AsyncIOScheduler — shares FastAPI's event loop).

Jobs:
  dispatch_scheduled_posts  — every 60 s, publish due posts via platform APIs
  poll_inbox                — every 5 min, pull new mentions/DMs from platforms
"""
import logging
from datetime import datetime, timezone

import uuid

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from database import get_db
from publishing import publish_post, publish_thread

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


# ── Post dispatch ─────────────────────────────────────────────────────────────

async def dispatch_scheduled_posts():
    db = get_db()
    if db is None:
        return
    now = datetime.now(timezone.utc)
    due = await db.posts.find(
        {"status": "scheduled", "scheduled_at": {"$lte": now}}, {"_id": 0}
    ).to_list(50)

    if not due:
        return

    # ── Separate thread tweets from standalone posts ──────────────────────
    # Thread posts carry a thread_id + thread_index and must be published
    # in index order, each tweet replying to the previous one.
    thread_groups: dict = {}
    standalone: list = []

    for post in due:
        tid = post.get("thread_id")
        if tid:
            thread_groups.setdefault(tid, []).append(post)
        else:
            standalone.append(post)

    # ── Standalone posts ──────────────────────────────────────────────────
    for post in standalone:
        result = await publish_post(post, db)
        event = "post.published" if result["status"] == "published" else "post.failed"
        await fire_webhooks(
            db, event,
            {"post_id": post["post_id"], "platform": post["platform"], **result},
        )

    # ── Thread groups ─────────────────────────────────────────────────────
    # Sort each group by thread_index so tweets chain in the right order.
    for tid, thread_posts in thread_groups.items():
        thread_posts.sort(key=lambda p: p.get("thread_index", 0))
        await publish_thread(thread_posts, db)
        # Fire a single webhook for the root tweet to signal the thread
        root = thread_posts[0]
        root_doc = await db.posts.find_one({"post_id": root["post_id"]}, {"_id": 0, "status": 1, "platform_post_id": 1})
        if root_doc:
            published_ok = root_doc.get("status") == "published"
            await fire_webhooks(
                db,
                "post.published" if published_ok else "post.failed",
                {
                    "post_id": root["post_id"],
                    "platform": root["platform"],
                    "thread_id": tid,
                    "thread_length": len(thread_posts),
                    "status": root_doc.get("status"),
                    "platform_post_id": root_doc.get("platform_post_id"),
                },
            )


# ── Inbox polling ─────────────────────────────────────────────────────────────

async def poll_inbox():
    db = get_db()
    if db is None:
        return
    accounts = await db.accounts.find({"is_active": True}, {"_id": 0}).to_list(100)
    for account in accounts:
        try:
            await _poll_account(account, db)
        except Exception as exc:
            logger.warning("Inbox poll failed %s: %s", account["account_id"], exc)


async def _poll_account(account: dict, db):
    platform = account["platform"]

    if platform == "twitter":
        import platforms.twitter as tw
        try:
            mentions = await tw.get_mentions(
                account["platform_user_id"], account["access_token"]
            )
        except Exception:
            return

        for m in mentions:
            item_id = f"tw_{m['id']}"
            existing = await db.inbox_items.find_one({"item_id": item_id})
            if existing:
                continue

            item = {
                "item_id": item_id,
                "platform": "twitter",
                "account_id": account["account_id"],
                "type": "mention",
                "sender_name": m.get("author_id", ""),
                "sender_username": m.get("author_id", ""),
                "sender_profile_image": "",
                "content": m.get("text", ""),
                "received_at": datetime.now(timezone.utc),
                "status": "unread",
                "tags": [],
                "platform_item_id": m["id"],
            }

            # Auto-tag with Claude
            try:
                import ai as ai_module
                tag = await ai_module.tag_inbox_message(m.get("text", ""))
                item["tags"] = [tag]
            except Exception:
                pass

            await db.inbox_items.insert_one(item)
            await fire_webhooks(
                db, "inbox.new_message", {"item_id": item_id, "platform": "twitter"}
            )

    elif platform == "instagram":
        # Instagram comments require iterating published posts and fetching comments
        # Implemented when posts exist in the system
        pass

    elif platform == "facebook":
        # Facebook page comments — implemented per-post
        pass

    elif platform == "linkedin":
        # LinkedIn comment polling — requires post URNs
        pass


# ── Webhook delivery ──────────────────────────────────────────────────────────

async def fire_webhooks(db, event: str, payload: dict):
    hooks = await db.webhooks.find(
        {"is_active": True, "events": event}, {"_id": 0}
    ).to_list(20)
    for hook in hooks:
        status = "success"
        error_msg = None
        http_status = None
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(hook["url"], json={"event": event, "data": payload})
                http_status = resp.status_code
                if resp.status_code >= 400:
                    status = "failed"
                    error_msg = f"HTTP {resp.status_code}"
        except Exception as exc:
            status = "failed"
            error_msg = str(exc)[:300]
            logger.warning("Webhook delivery failed (%s): %s", hook["url"], exc)
        # Persist delivery attempt
        try:
            from datetime import datetime, timezone
            await db.webhook_deliveries.insert_one({
                "delivery_id": str(uuid.uuid4()),
                "webhook_id": hook.get("webhook_id", ""),
                "url": hook["url"],
                "event": event,
                "payload": payload,
                "status": status,
                "http_status": http_status,
                "error": error_msg,
                "delivered_at": datetime.now(timezone.utc),
            })
        except Exception as log_exc:
            logger.warning("Failed to log webhook delivery: %s", log_exc)


# ── Lifecycle ─────────────────────────────────────────────────────────────────

def start_scheduler():
    scheduler.add_job(
        dispatch_scheduled_posts,
        trigger=IntervalTrigger(seconds=60),
        id="dispatch_posts",
        replace_existing=True,
    )
    scheduler.add_job(
        poll_inbox,
        trigger=IntervalTrigger(seconds=300),
        id="poll_inbox",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler stopped")
