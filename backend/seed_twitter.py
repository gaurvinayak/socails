"""
Seed Twitter/X account directly using OAuth 2.0 access + refresh tokens.
Run: python seed_twitter.py
"""
import asyncio
import uuid
from datetime import datetime, timezone, timedelta

import httpx
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = "mongodb://localhost:27017"
DB_NAME   = "socails"

ACCESS_TOKEN  = "am9vVW0xUXpvWXRvWVNiMjJhM3p0elAwbE5LX1NTMFM4dHZVVXBPWmpkWU9sOjE3Nzk5OTIyOTcxMzQ6MTowOmF0OjE"
REFRESH_TOKEN = "d1NlZGxOcXpfZDN5eUNTelpjNFBZdENNUnVpQk9ZVjRrWVhWZi1HekxOSWFrOjE3Nzk5OTIyOTcxMzQ6MTowOnJ0OjE"


async def fetch_profile(token: str) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            "https://api.twitter.com/2/users/me",
            params={"user.fields": "id,name,username,profile_image_url,public_metrics"},
            headers={"Authorization": f"Bearer {token}"},
        )
        r.raise_for_status()
        data = r.json().get("data", {})
    return {
        "platform_user_id": data["id"],
        "username":         data.get("username", ""),
        "display_name":     data.get("name", ""),
        "profile_image_url": data.get("profile_image_url", "").replace("_normal", ""),
        "followers_count":  data.get("public_metrics", {}).get("followers_count", 0),
    }


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print("Fetching Twitter profile...")
    try:
        profile = await fetch_profile(ACCESS_TOKEN)
        print(f"  -> @{profile['username']}  ({profile['followers_count']} followers)")
    except Exception as e:
        print(f"  [!] Could not fetch profile ({e})")
        client.close()
        return

    doc = {
        "account_id":        str(uuid.uuid4()),
        "platform":          "twitter",
        "platform_user_id":  profile["platform_user_id"],
        "username":          profile["username"],
        "display_name":      profile["display_name"],
        "profile_image_url": profile["profile_image_url"],
        "followers_count":   profile["followers_count"],
        "access_token":      ACCESS_TOKEN,
        "refresh_token":     REFRESH_TOKEN,
        "token_expires_at":  datetime.now(timezone.utc) + timedelta(hours=2),
        "scopes":            ["tweet.read", "tweet.write", "users.read", "offline.access", "dm.read", "dm.write"],
        "connected_at":      datetime.now(timezone.utc),
        "is_active":         True,
    }

    res = await db.accounts.update_one(
        {"platform": "twitter", "platform_user_id": profile["platform_user_id"]},
        {"$set": doc}, upsert=True,
    )
    print(f"  OK Twitter upserted (matched={res.matched_count}, upserted={res.upserted_id is not None})")
    client.close()
    print("\nDone - refresh the Account Hub.")


if __name__ == "__main__":
    asyncio.run(main())
