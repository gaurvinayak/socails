"""
One-shot script to seed Instagram and LinkedIn accounts into MongoDB
using tokens provided directly (bypasses the OAuth flow).

Run: python seed_accounts.py
"""
import asyncio
import uuid
from datetime import datetime, timezone, timedelta

import httpx
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = "mongodb://localhost:27017"
DB_NAME   = "socails"

INSTAGRAM_ACCESS_TOKEN = "EAAM24kcyPMcBRqys4tDrS2woAz4ZAmRfA6uTics8xa7EyrjAgk3IxJyOwArSSdIEN126hZAojmvfQQKCcyZBBXQZC2z1bmjvTVGGXDZAeHZAW2po8NrO9ruiJ1RNZA0ohgP7zYiXz03wvDDNCfaNPNLyytmY0xalMmAl6ObAKEQfkRoOZBbGoZBI2vR72DcZA7TXsgJulcRBIlI8VO8cZAFi7KDZCwrVen7JpPz4NEn5G2VFNnwCWzZABDRuu6yFiZCaVPbNiJ8V1KPyf3LvJCZCCSYGwZDZD"
INSTAGRAM_USER_ID      = "17841470404022447"

LINKEDIN_ACCESS_TOKEN  = "AQWyYtThieX6txyOFhBF3mTc-cVnMJvtqaSloXZOzfAxrpM_eOwwBAOemF0R5x0OcoiDGK_9CAbeb7koyAmNJyWJK0HdEsDYQ5qUIrMKb6hWTBr2MSsbbIORKu_SeeGThVOC1mmqSDn8OHswXlqwx_tm-7tL0QqkvY8r7uWWg0fxWgJdMp6aCBIqien3AKd7NiTSd-8z_0sKg78rIKUkW9SdJBBwDKDjsaDpr8O2xAm3NMYChUhMCQwQF7GVHLdHV-RorH4VmmnLcGcceCqk42h64ZRb_I0cj0HmL3gsJjY4t98oSvq0jtMxFb2NeLAk7Aj0P2QmRtj9WQ6kHBg8BrHpBIXICA"
LINKEDIN_AUTHOR_URN_ID = "r9hLouiTgw"   # the ID portion of urn:li:person:...


async def fetch_instagram_profile(token: str, user_id: str) -> dict:
    # Instagram Business accounts must be queried via graph.facebook.com
    params = {
        "fields": "id,username,name,followers_count,profile_picture_url",
        "access_token": token,
    }
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(f"https://graph.facebook.com/v19.0/{user_id}", params=params)
        r.raise_for_status()
        data = r.json()
    return {
        "platform_user_id": data.get("id", user_id),
        "username":         data.get("username", user_id),
        "display_name":     data.get("name") or data.get("username", user_id),
        "profile_image_url": data.get("profile_picture_url", ""),
        "followers_count":  data.get("followers_count", 0),
    }


async def fetch_linkedin_profile(token: str) -> dict:
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get("https://api.linkedin.com/v2/userinfo", headers=headers)
        r.raise_for_status()
        data = r.json()
    sub = data.get("sub", LINKEDIN_AUTHOR_URN_ID)
    name = data.get("name") or f"{data.get('given_name','')} {data.get('family_name','')}".strip()
    return {
        "platform_user_id": sub,
        "username":         data.get("email") or sub,
        "display_name":     name or sub,
        "profile_image_url": data.get("picture", ""),
        "followers_count":  0,
    }


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    # ── Instagram ──────────────────────────────────────────────
    print("Fetching Instagram profile…")
    try:
        ig = await fetch_instagram_profile(INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_USER_ID)
        print(f"  -> @{ig['username']}  ({ig['followers_count']} followers)")
    except Exception as e:
        print(f"  [!] Could not fetch IG profile ({e}), using stub values")
        ig = {
            "platform_user_id": INSTAGRAM_USER_ID,
            "username":         INSTAGRAM_USER_ID,
            "display_name":     "Instagram Account",
            "profile_image_url": "",
            "followers_count":  0,
        }

    ig_doc = {
        "account_id":       str(uuid.uuid4()),
        "platform":         "instagram",
        "platform_user_id": ig["platform_user_id"],
        "username":         ig["username"],
        "display_name":     ig["display_name"],
        "profile_image_url": ig["profile_image_url"],
        "followers_count":  ig["followers_count"],
        "access_token":     INSTAGRAM_ACCESS_TOKEN,
        "refresh_token":    None,
        # Long-lived tokens last ~60 days
        "token_expires_at": datetime.now(timezone.utc) + timedelta(days=60),
        "scopes":           ["instagram_basic", "instagram_content_publish", "instagram_manage_comments"],
        "connected_at":     datetime.now(timezone.utc),
        "is_active":        True,
        "page_id":          ig["platform_user_id"],
    }
    res = await db.accounts.update_one(
        {"platform": "instagram", "platform_user_id": ig["platform_user_id"]},
        {"$set": ig_doc}, upsert=True,
    )
    print(f"  OK Instagram upserted (matched={res.matched_count}, upserted={res.upserted_id is not None})")

    # ── LinkedIn ───────────────────────────────────────────────
    print("Fetching LinkedIn profile…")
    try:
        li = await fetch_linkedin_profile(LINKEDIN_ACCESS_TOKEN)
        print(f"  -> {li['display_name']}  (sub={li['platform_user_id']})")
    except Exception as e:
        print(f"  [!] Could not fetch LI profile ({e}), using stub values")
        li = {
            "platform_user_id": LINKEDIN_AUTHOR_URN_ID,
            "username":         LINKEDIN_AUTHOR_URN_ID,
            "display_name":     "LinkedIn Account",
            "profile_image_url": "",
            "followers_count":  0,
        }

    li_doc = {
        "account_id":       str(uuid.uuid4()),
        "platform":         "linkedin",
        "platform_user_id": li["platform_user_id"],
        "username":         li["username"],
        "display_name":     li["display_name"],
        "profile_image_url": li["profile_image_url"],
        "followers_count":  li["followers_count"],
        "access_token":     LINKEDIN_ACCESS_TOKEN,
        "refresh_token":    None,
        "token_expires_at": datetime.now(timezone.utc) + timedelta(days=60),
        "scopes":           ["openid", "profile", "email", "w_member_social"],
        "connected_at":     datetime.now(timezone.utc),
        "is_active":        True,
        # LinkedIn posts use urn:li:person:{id}
        "author_urn":       f"urn:li:person:{LINKEDIN_AUTHOR_URN_ID}",
    }
    res = await db.accounts.update_one(
        {"platform": "linkedin", "platform_user_id": li["platform_user_id"]},
        {"$set": li_doc}, upsert=True,
    )
    print(f"  OK LinkedIn upserted (matched={res.matched_count}, upserted={res.upserted_id is not None})")

    client.close()
    print("\nDone — refresh the Account Hub in the browser.")


if __name__ == "__main__":
    asyncio.run(main())
