"""
Facebook Pages OAuth via Meta Graph API.

Uses the same Meta App as instagram.py (META_APP_ID / META_APP_SECRET).

Setup in Meta for Developers:
  1. Same app as Instagram — add "Facebook Login" product
  2. Add redirect URI: http://localhost:8002/api/auth/facebook/callback
  3. Required permissions: pages_manage_posts, pages_read_engagement,
     pages_manage_metadata, pages_messaging, pages_show_list, public_profile

Each Facebook Page the user manages becomes a separate connected account.
Page-level access tokens (never-expiring) are stored instead of the user token.
"""
import os
import urllib.parse

import httpx

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8002")
REDIRECT_URI = f"{BACKEND_URL}/api/auth/facebook/callback"

SCOPES = [
    "pages_manage_posts",
    "pages_read_engagement",
    "pages_manage_metadata",
    "pages_messaging",
    "pages_show_list",
    "public_profile",
]


def get_auth_url(state: str) -> str:
    params = {
        "client_id": os.getenv("META_APP_ID"),
        "redirect_uri": REDIRECT_URI,
        "scope": ",".join(SCOPES),
        "response_type": "code",
        "state": state,
    }
    return "https://www.facebook.com/v19.0/dialog/oauth?" + urllib.parse.urlencode(params)


async def exchange_code(code: str) -> dict:
    """Exchange authorization code for a short-lived user access token."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://graph.facebook.com/v19.0/oauth/access_token",
            data={
                "client_id": os.getenv("META_APP_ID"),
                "client_secret": os.getenv("META_APP_SECRET"),
                "redirect_uri": REDIRECT_URI,
                "code": code,
            },
        )
        resp.raise_for_status()
        return resp.json()


async def get_long_lived_token(short_lived_token: str) -> dict:
    """Exchange short-lived user token for a long-lived user token (~60 days)."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://graph.facebook.com/v19.0/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": os.getenv("META_APP_ID"),
                "client_secret": os.getenv("META_APP_SECRET"),
                "fb_exchange_token": short_lived_token,
            },
        )
        resp.raise_for_status()
        return resp.json()


async def get_pages(user_token: str) -> list[dict]:
    """
    Return all Facebook Pages the user manages.
    Stores the page-level access token (doesn't expire) for each page.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://graph.facebook.com/v19.0/me/accounts",
            params={
                "access_token": user_token,
                "fields": "id,name,access_token,picture{url},fan_count,category",
            },
        )
        resp.raise_for_status()
        pages = resp.json().get("data", [])

    return [
        {
            "platform_user_id": p["id"],
            "username": p.get("name", "").lower().replace(" ", "_"),
            "display_name": p.get("name", ""),
            "profile_image_url": p.get("picture", {}).get("data", {}).get("url", ""),
            "page_access_token": p.get("access_token", ""),
            "followers_count": p.get("fan_count", 0),
            "category": p.get("category", ""),
        }
        for p in pages
    ]


async def publish_post(page_id: str, message: str, page_token: str, link: str = None) -> dict:
    """Publish a text (or link) post to a Facebook Page."""
    params = {"message": message, "access_token": page_token}
    if link:
        params["link"] = link

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://graph.facebook.com/v19.0/{page_id}/feed",
            params=params,
        )
        resp.raise_for_status()
        return resp.json()


async def publish_photo(page_id: str, image_url: str, caption: str, page_token: str) -> dict:
    """Publish a photo post to a Facebook Page."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://graph.facebook.com/v19.0/{page_id}/photos",
            params={
                "url": image_url,
                "caption": caption,
                "access_token": page_token,
            },
        )
        resp.raise_for_status()
        return resp.json()


async def get_post_insights(post_id: str, page_token: str) -> dict:
    """Fetch insights for a Page post."""
    metrics = "post_impressions,post_engagements,post_reactions_by_type_total,post_clicks"
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://graph.facebook.com/v19.0/{post_id}/insights",
            params={"metric": metrics, "access_token": page_token},
        )
        resp.raise_for_status()
        return resp.json()


async def get_comments(post_id: str, page_token: str) -> list[dict]:
    """Fetch comments on a Page post."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://graph.facebook.com/v19.0/{post_id}/comments",
            params={
                "fields": "id,message,from,created_time",
                "access_token": page_token,
            },
        )
        resp.raise_for_status()
        return resp.json().get("data", [])


async def reply_to_comment(comment_id: str, message: str, page_token: str) -> dict:
    """Reply to a comment on a Page post."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://graph.facebook.com/v19.0/{comment_id}/comments",
            params={"message": message, "access_token": page_token},
        )
        resp.raise_for_status()
        return resp.json()


async def get_conversations(page_id: str, page_token: str) -> list[dict]:
    """Fetch Messenger conversations for a Page."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://graph.facebook.com/v19.0/{page_id}/conversations",
            params={
                "fields": "id,participants,updated_time,unread_count",
                "access_token": page_token,
            },
        )
        resp.raise_for_status()
        return resp.json().get("data", [])


async def send_message(recipient_id: str, text: str, page_token: str) -> dict:
    """Send a Messenger message from a Page."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://graph.facebook.com/v19.0/me/messages",
            params={"access_token": page_token},
            json={"recipient": {"id": recipient_id}, "message": {"text": text}},
        )
        resp.raise_for_status()
        return resp.json()
