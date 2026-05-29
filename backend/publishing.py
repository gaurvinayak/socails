"""
Core publishing logic — called by both the API endpoint and the scheduler.
Each platform's actual API call lives in platforms/*.py; this module
coordinates: picks the right client, dispatches, updates MongoDB.
"""
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


async def publish_post(post: dict, db) -> dict:
    """
    Send a post to its platform and update its MongoDB document.
    Returns {"status": "published"|"failed", ...}
    """
    import platforms.facebook as fb
    import platforms.instagram as ig
    import platforms.linkedin as li
    import platforms.twitter as tw

    account = await db.accounts.find_one(
        {"account_id": post["account_id"], "is_active": True}
    )
    if not account:
        await db.posts.update_one(
            {"post_id": post["post_id"]},
            {"$set": {"status": "failed", "error_message": "Account disconnected"}},
        )
        return {"status": "failed", "error": "Account disconnected"}

    platform = post["platform"]
    access_token = account["access_token"]
    content = post["content"]
    media_urls = post.get("media_urls", [])
    platform_post_id = None

    try:
        if platform == "twitter":
            result = await tw.post_tweet(content, access_token)
            platform_post_id = result.get("data", {}).get("id")

        elif platform == "instagram":
            if not media_urls:
                raise ValueError("Instagram requires at least one image URL.")
            result = await ig.publish_image(
                account["platform_user_id"], media_urls[0], content, access_token
            )
            platform_post_id = result.get("id")

        elif platform == "facebook":
            page_id = account.get("page_id") or account["platform_user_id"]
            result = await fb.publish_post(
                page_id, content, access_token,
                link=media_urls[0] if media_urls else None,
            )
            platform_post_id = result.get("id")

        elif platform == "linkedin":
            author_urn = f"urn:li:person:{account['platform_user_id']}"
            result = await li.create_post(author_urn, content, access_token)
            platform_post_id = result.get("post_urn")

        await db.posts.update_one(
            {"post_id": post["post_id"]},
            {
                "$set": {
                    "status": "published",
                    "published_at": datetime.now(timezone.utc),
                    "platform_post_id": platform_post_id,
                    "error_message": None,
                }
            },
        )
        logger.info("Published post %s on %s (platform_id=%s)", post["post_id"], platform, platform_post_id)
        return {"status": "published", "platform_post_id": platform_post_id}

    except Exception as exc:
        logger.error("Publish failed %s: %s", post["post_id"], exc)
        await db.posts.update_one(
            {"post_id": post["post_id"]},
            {"$set": {"status": "failed", "error_message": str(exc)[:500]}},
        )
        return {"status": "failed", "error": str(exc)[:500]}
