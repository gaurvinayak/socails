"""
YouTube Data API v3 — OAuth 2.0.

Setup in Google Cloud Console (https://console.cloud.google.com):
  1. Create a project → Enable YouTube Data API v3
  2. Create OAuth 2.0 credentials (Web application)
  3. Add redirect URI: http://localhost:8002/api/auth/youtube/callback
  4. Save to .env as YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET

Scopes: youtube.upload, youtube.readonly, userinfo.profile
"""
import os
import urllib.parse

import httpx

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8002")
REDIRECT_URI = f"{BACKEND_URL}/api/auth/youtube/callback"

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
]


def get_auth_url(state: str) -> str:
    params = {
        "client_id": os.getenv("YOUTUBE_CLIENT_ID"),
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "state": state,
        "access_type": "offline",
        "prompt": "consent",
    }
    return "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)


async def exchange_code(code: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": os.getenv("YOUTUBE_CLIENT_ID"),
                "client_secret": os.getenv("YOUTUBE_CLIENT_SECRET"),
                "redirect_uri": REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        resp.raise_for_status()
        return resp.json()


async def refresh_access_token(refresh_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "refresh_token": refresh_token,
                "client_id": os.getenv("YOUTUBE_CLIENT_ID"),
                "client_secret": os.getenv("YOUTUBE_CLIENT_SECRET"),
                "grant_type": "refresh_token",
            },
        )
        resp.raise_for_status()
        return resp.json()


async def get_user_profile(access_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        profile_resp = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        profile_resp.raise_for_status()
        profile = profile_resp.json()

        channel_resp = await client.get(
            "https://www.googleapis.com/youtube/v3/channels",
            params={"part": "snippet,statistics", "mine": "true"},
            headers={"Authorization": f"Bearer {access_token}"},
        )
        followers_count = 0
        channel_id = profile.get("id", "")
        if channel_resp.status_code == 200:
            items = channel_resp.json().get("items", [])
            if items:
                channel_id = items[0].get("id", channel_id)
                followers_count = int(
                    items[0].get("statistics", {}).get("subscriberCount", 0)
                )

        return {
            "platform_user_id": channel_id,
            "username": profile.get("email", channel_id),
            "display_name": profile.get("name", ""),
            "profile_image_url": profile.get("picture", ""),
            "followers_count": followers_count,
        }


async def upload_video(
    video_path: str,
    title: str,
    description: str,
    access_token: str,
    privacy_status: str = "public",
    tags: list[str] | None = None,
) -> dict:
    """Upload a local video file to YouTube using resumable upload."""
    metadata = {
        "snippet": {
            "title": title[:100],
            "description": description,
            "categoryId": "22",
            "tags": tags or [],
        },
        "status": {"privacyStatus": privacy_status},
    }
    async with httpx.AsyncClient(timeout=300) as client:
        init_resp = await client.post(
            "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
            json=metadata,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json; charset=UTF-8",
                "X-Upload-Content-Type": "video/*",
            },
        )
        init_resp.raise_for_status()
        upload_url = init_resp.headers.get("Location")

        with open(video_path, "rb") as f:
            video_data = f.read()

        upload_resp = await client.put(
            upload_url,
            content=video_data,
            headers={"Content-Type": "video/*"},
        )
        upload_resp.raise_for_status()
        return upload_resp.json()


async def get_video_metrics(video_id: str, access_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://www.googleapis.com/youtube/v3/videos",
            params={"part": "statistics", "id": video_id},
            headers={"Authorization": f"Bearer {access_token}"},
        )
        resp.raise_for_status()
        items = resp.json().get("items", [])
        if not items:
            return {}
        stats = items[0].get("statistics", {})
        return {
            "views": int(stats.get("viewCount", 0)),
            "likes": int(stats.get("likeCount", 0)),
            "comments": int(stats.get("commentCount", 0)),
            "reach": int(stats.get("viewCount", 0)),
        }
