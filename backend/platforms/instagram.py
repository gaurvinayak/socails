"""
Instagram OAuth via Meta Graph API.

Setup in Meta for Developers (https://developers.facebook.com):
  1. Create an app (type: Business)
  2. Add "Instagram Graph API" product
  3. Add redirect URI: http://localhost:8002/api/auth/instagram/callback
  4. Required scopes: instagram_basic, instagram_content_publish,
     instagram_manage_comments, instagram_manage_insights,
     pages_show_list, pages_read_engagement, pages_manage_posts

Note: META_APP_ID and META_APP_SECRET are shared with facebook.py.
"""
import os
import urllib.parse
import httpx

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8002")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3001")

SCOPES = [
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_comments",
    "instagram_manage_insights",
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
]

REDIRECT_URI = f"{BACKEND_URL}/api/auth/instagram/callback"


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
    """Exchange short-lived token for a long-lived token (~60 days)."""
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


async def get_instagram_accounts(user_token: str) -> list[dict]:
    """
    Fetch all Instagram Business/Creator accounts linked to the user's
    Facebook Pages. Returns one account dict per IG account found.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://graph.facebook.com/v19.0/me/accounts",
            params={
                "access_token": user_token,
                "fields": (
                    "id,name,instagram_business_account"
                    "{id,name,username,profile_picture_url,followers_count}"
                ),
            },
        )
        resp.raise_for_status()
        pages = resp.json().get("data", [])

    accounts = []
    for page in pages:
        ig = page.get("instagram_business_account")
        if ig:
            accounts.append(
                {
                    "platform_user_id": ig["id"],
                    "username": ig.get("username", ""),
                    "display_name": ig.get("name", ""),
                    "profile_image_url": ig.get("profile_picture_url", ""),
                    "followers_count": ig.get("followers_count", 0),
                    "page_id": page["id"],
                    "page_name": page["name"],
                }
            )
    return accounts


async def publish_image(ig_account_id: str, image_url: str, caption: str, access_token: str) -> dict:
    """Publish a single image post to an Instagram Business account."""
    async with httpx.AsyncClient() as client:
        # Step 1: create media container
        container_resp = await client.post(
            f"https://graph.facebook.com/v19.0/{ig_account_id}/media",
            params={
                "image_url": image_url,
                "caption": caption,
                "access_token": access_token,
            },
        )
        container_resp.raise_for_status()
        container_id = container_resp.json()["id"]

        # Step 2: publish the container
        publish_resp = await client.post(
            f"https://graph.facebook.com/v19.0/{ig_account_id}/media_publish",
            params={"creation_id": container_id, "access_token": access_token},
        )
        publish_resp.raise_for_status()
        return publish_resp.json()


async def get_media_insights(media_id: str, access_token: str) -> dict:
    """Fetch insights for a published post."""
    metrics = "impressions,reach,likes,comments,shares,saved"
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://graph.facebook.com/v19.0/{media_id}/insights",
            params={"metric": metrics, "access_token": access_token},
        )
        resp.raise_for_status()
        return resp.json()


async def get_comments(media_id: str, access_token: str) -> list[dict]:
    """Fetch comments on a post."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://graph.facebook.com/v19.0/{media_id}/comments",
            params={
                "fields": "id,text,username,timestamp,replies{id,text,username,timestamp}",
                "access_token": access_token,
            },
        )
        resp.raise_for_status()
        return resp.json().get("data", [])


async def reply_to_comment(comment_id: str, message: str, access_token: str) -> dict:
    """Reply to an Instagram comment."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://graph.facebook.com/v19.0/{comment_id}/replies",
            params={"message": message, "access_token": access_token},
        )
        resp.raise_for_status()
        return resp.json()
