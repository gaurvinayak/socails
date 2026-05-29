"""
X (Twitter) OAuth 2.0 with PKCE — Twitter API v2.

Setup in Twitter Developer Portal (https://developer.twitter.com):
  1. Create a Project + App
  2. Enable OAuth 2.0, set Type of App: Web App
  3. Add callback URI: http://localhost:8002/api/auth/twitter/callback
  4. Add website URL: http://localhost:3001
  5. Save Client ID and Client Secret to .env

Required scopes: tweet.read tweet.write users.read offline.access dm.read dm.write
"""
import os
import base64
import hashlib
import secrets
import urllib.parse
from typing import Tuple

import httpx

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8002")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3001")
REDIRECT_URI = f"{BACKEND_URL}/api/auth/twitter/callback"

SCOPES = [
    "tweet.read",
    "tweet.write",
    "users.read",
    "offline.access",
    "dm.read",
    "dm.write",
]


def generate_pkce_pair() -> Tuple[str, str]:
    """Return (code_verifier, code_challenge) for PKCE."""
    code_verifier = (
        base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b"=").decode()
    )
    digest = hashlib.sha256(code_verifier.encode()).digest()
    code_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return code_verifier, code_challenge


def get_auth_url(state: str, code_challenge: str) -> str:
    params = {
        "response_type": "code",
        "client_id": os.getenv("TWITTER_CLIENT_ID"),
        "redirect_uri": REDIRECT_URI,
        "scope": " ".join(SCOPES),
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    return "https://twitter.com/i/oauth2/authorize?" + urllib.parse.urlencode(params)


async def exchange_code(code: str, code_verifier: str) -> dict:
    """Exchange authorization code + PKCE verifier for access/refresh tokens."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.twitter.com/2/oauth2/token",
            data={
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": REDIRECT_URI,
                "code_verifier": code_verifier,
            },
            auth=(os.getenv("TWITTER_CLIENT_ID"), os.getenv("TWITTER_CLIENT_SECRET")),
        )
        resp.raise_for_status()
        return resp.json()


async def refresh_access_token(refresh_token: str) -> dict:
    """Refresh an expired access token using the stored refresh token."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.twitter.com/2/oauth2/token",
            data={
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            },
            auth=(os.getenv("TWITTER_CLIENT_ID"), os.getenv("TWITTER_CLIENT_SECRET")),
        )
        resp.raise_for_status()
        return resp.json()


async def get_user_profile(access_token: str) -> dict:
    """Return the authenticated user's profile."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.twitter.com/2/users/me",
            params={
                "user.fields": "id,name,username,profile_image_url,public_metrics"
            },
            headers={"Authorization": f"Bearer {access_token}"},
        )
        resp.raise_for_status()
        data = resp.json().get("data", {})
        return {
            "platform_user_id": data["id"],
            "username": data.get("username", ""),
            "display_name": data.get("name", ""),
            # Remove _normal suffix for full-size avatar
            "profile_image_url": data.get("profile_image_url", "").replace(
                "_normal", ""
            ),
            "followers_count": data.get("public_metrics", {}).get(
                "followers_count", 0
            ),
        }


async def post_tweet(content: str, access_token: str, reply_to_id: str = None) -> dict:
    """Post a tweet. Pass reply_to_id to create a reply."""
    body = {"text": content}
    if reply_to_id:
        body["reply"] = {"in_reply_to_tweet_id": reply_to_id}

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.twitter.com/2/tweets",
            json=body,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        resp.raise_for_status()
        return resp.json()


async def get_tweet_metrics(tweet_id: str, access_token: str) -> dict:
    """Fetch public + non-public metrics for a tweet."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.twitter.com/2/tweets/{tweet_id}",
            params={
                "tweet.fields": "public_metrics,non_public_metrics,created_at"
            },
            headers={"Authorization": f"Bearer {access_token}"},
        )
        resp.raise_for_status()
        return resp.json().get("data", {})


async def get_mentions(user_id: str, access_token: str, since_id: str = None) -> list[dict]:
    """Fetch recent mentions of the authenticated user."""
    params = {
        "tweet.fields": "id,text,author_id,created_at,public_metrics",
        "expansions": "author_id",
        "user.fields": "name,username,profile_image_url",
        "max_results": 10,
    }
    if since_id:
        params["since_id"] = since_id

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.twitter.com/2/users/{user_id}/mentions",
            params=params,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        resp.raise_for_status()
        return resp.json().get("data", [])


async def get_dms(access_token: str) -> list[dict]:
    """Fetch recent DMs for the authenticated user."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.twitter.com/2/dm_events",
            params={
                "dm_event.fields": "id,text,sender_id,created_at",
                "event_types": "MessageCreate",
                "max_results": 50,
            },
            headers={"Authorization": f"Bearer {access_token}"},
        )
        resp.raise_for_status()
        return resp.json().get("data", [])
