"""
Core publishing logic — called by both the API endpoint and the scheduler.
Each platform's actual API call lives in platforms/*.py; this module
coordinates: picks the right client, dispatches, updates MongoDB.
"""
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)


async def _get_valid_token(account: dict, db) -> str:
    """Return a valid access token, refreshing via refresh_token if expired."""
    import platforms.twitter as tw

    expires_at = account.get("token_expires_at")
    refresh_token = account.get("refresh_token")

    if expires_at and refresh_token:
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        now = datetime.now(timezone.utc)
        # Refresh if expired or within 60 seconds of expiry
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if now >= expires_at - timedelta(seconds=60):
            if account["platform"] == "twitter":
                logger.info("Refreshing Twitter token for account %s", account["account_id"])
                try:
                    tokens = await tw.refresh_access_token(refresh_token)
                    new_access = tokens["access_token"]
                    new_refresh = tokens.get("refresh_token", refresh_token)
                    new_expires = now + timedelta(seconds=tokens.get("expires_in", 7200))
                    await db.accounts.update_one(
                        {"account_id": account["account_id"]},
                        {"$set": {
                            "access_token": new_access,
                            "refresh_token": new_refresh,
                            "token_expires_at": new_expires,
                        }},
                    )
                    return new_access
                except Exception as exc:
                    logger.error("Token refresh failed for %s: %s", account["account_id"], exc)
                    raise RuntimeError(
                        f"Twitter token expired and refresh failed: {exc}. "
                        "Re-connect the account via the Account Hub."
                    ) from exc

    return account["access_token"]


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
    access_token = await _get_valid_token(account, db)
    content = post["content"]
    media_urls = post.get("media_urls", [])
    platform_post_id = None

    try:
        if platform == "twitter":
            # Pass poll data if this is a poll post
            poll_opts = post.get("poll_options") if post.get("post_type") == "poll" else None
            result = await tw.post_tweet(
                content, access_token,
                poll_options=poll_opts,
                poll_duration_minutes=post.get("poll_duration_minutes"),
            )
            platform_post_id = result.get("data", {}).get("id")

        elif platform in ("tiktok", "youtube"):
            raise ValueError(
                f"{platform.capitalize()} direct publishing is not yet implemented. "
                "Schedule the post and publish manually, or use the platform's native scheduler."
            )

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


async def publish_thread(thread_posts: list, db) -> None:
    """
    Publish a Twitter/X thread in order.

    thread_posts MUST be pre-sorted by thread_index (ascending).
    Each tweet is posted as a reply to the previous one so they chain
    into a real thread rather than landing as standalone tweets.

    On any failure the remaining tweets are immediately marked 'failed'
    with a message explaining the thread broke at that point.
    """
    import platforms.twitter as tw

    if not thread_posts:
        return

    account = await db.accounts.find_one(
        {"account_id": thread_posts[0]["account_id"], "is_active": True}
    )
    if not account:
        for post in thread_posts:
            await db.posts.update_one(
                {"post_id": post["post_id"]},
                {"$set": {"status": "failed", "error_message": "Account disconnected"}},
            )
        return

    try:
        access_token = await _get_valid_token(account, db)
    except Exception as exc:
        for post in thread_posts:
            await db.posts.update_one(
                {"post_id": post["post_id"]},
                {"$set": {"status": "failed", "error_message": str(exc)[:500]}},
            )
        return

    reply_to_id = None  # first tweet has no parent
    failed_from = None

    for i, post in enumerate(thread_posts):
        if failed_from is not None:
            # A previous tweet in this thread failed — mark the rest too
            await db.posts.update_one(
                {"post_id": post["post_id"]},
                {
                    "$set": {
                        "status": "failed",
                        "error_message": f"Thread broken at tweet {failed_from + 1} — earlier tweet failed",
                    }
                },
            )
            continue

        try:
            result = await tw.post_tweet(post["content"], access_token, reply_to_id=reply_to_id)
            tweet_id = result.get("data", {}).get("id")
            reply_to_id = tweet_id  # next tweet chains from this one
            await db.posts.update_one(
                {"post_id": post["post_id"]},
                {
                    "$set": {
                        "status": "published",
                        "published_at": datetime.now(timezone.utc),
                        "platform_post_id": tweet_id,
                        "error_message": None,
                    }
                },
            )
            logger.info(
                "Thread tweet %d/%d published (id=%s thread=%s)",
                i + 1, len(thread_posts), tweet_id,
                post.get("thread_id", "?"),
            )
        except Exception as exc:
            logger.error("Thread tweet %d failed %s: %s", i + 1, post["post_id"], exc)
            await db.posts.update_one(
                {"post_id": post["post_id"]},
                {"$set": {"status": "failed", "error_message": str(exc)[:500]}},
            )
            failed_from = i  # mark so remaining tweets are also failed
