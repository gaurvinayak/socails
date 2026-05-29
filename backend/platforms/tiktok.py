"""
TikTok OAuth 2.0 + Content Publishing API v2.

Setup in TikTok Developer Portal (https://developers.tiktok.com):
  1. Create an app — enable "Login Kit" and "Content Posting API"
  2. Add redirect URI: http://localhost:8002/api/auth/tiktok/callback
  3. Save Client Key + Client Secret to .env as TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET

Required scopes: user.info.basic, video.upload, video.publish
"""
import base64
import hashlib
import os
import secrets
import urllib.parse
from typing import Tuple

import httpx

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8002")
REDIRECT_URI = f"{BACKEND_URL}/api/auth/tiktok/callback"

SCOPES = ["user.info.basic", "video.upload", "video.publish"]


def generate_pkce_pair() -> Tuple[str, str]:
    code_verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b"=").decode()
    digest = hashlib.sha256(code_verifier.encode()).digest()
    code_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return code_verifier, code_challenge


def get_auth_url(state: str, code_challenge: str) -> str:
    params = {
        "client_key": os.getenv("TIKTOK_CLIENT_KEY"),
        "scope": ",".join(SCOPES),
        "response_type": "code",
        "redirect_uri": REDIRECT_URI,
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    return "https://www.tiktok.com/v2/auth/authorize/?" + urllib.parse.urlencode(params)


async def exchange_code(code: str, code_verifier: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://open.tiktokapis.com/v2/oauth/token/",
            data={
                "client_key": os.getenv("TIKTOK_CLIENT_KEY"),
                "client_secret": os.getenv("TIKTOK_CLIENT_SECRET"),
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": REDIRECT_URI,
                "code_verifier": code_verifier,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        resp.raise_for_status()
        return resp.json()


async def refresh_access_token(refresh_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://open.tiktokapis.com/v2/oauth/token/",
            data={
                "client_key": os.getenv("TIKTOK_CLIENT_KEY"),
                "client_secret": os.getenv("TIKTOK_CLIENT_SECRET"),
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        resp.raise_for_status()
        return resp.json()


async def get_user_profile(access_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://open.tiktokapis.com/v2/user/info/",
            params={"fields": "open_id,avatar_url,display_name,follower_count"},
            headers={"Authorization": f"Bearer {access_token}"},
        )
        resp.raise_for_status()
        data = resp.json().get("data", {}).get("user", {})
        return {
            "platform_user_id": data.get("open_id", ""),
            "username": data.get("open_id", ""),
            "display_name": data.get("display_name", ""),
            "profile_image_url": data.get("avatar_url", ""),
            "followers_count": data.get("follower_count", 0),
        }


async def post_video_by_url(
    video_url: str,
    title: str,
    access_token: str,
    privacy: str = "PUBLIC_TO_EVERYONE",
) -> dict:
    """Publish a video by URL via TikTok Content Posting API Direct Post."""
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://open.tiktokapis.com/v2/post/publish/video/init/",
            json={
                "post_info": {
                    "title": title[:150],
                    "privacy_level": privacy,
                    "disable_duet": False,
                    "disable_comment": False,
                    "disable_stitch": False,
                    "video_cover_timestamp_ms": 1000,
                },
                "source_info": {
                    "source": "PULL_FROM_URL",
                    "video_url": video_url,
                },
            },
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json; charset=UTF-8",
            },
        )
        resp.raise_for_status()
        return resp.json()


async def get_video_status(publish_id: str, access_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
            json={"publish_id": publish_id},
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json; charset=UTF-8",
            },
        )
        resp.raise_for_status()
        return resp.json()
