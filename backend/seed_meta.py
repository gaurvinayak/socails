"""
Seed Instagram + Facebook accounts using a short-lived Meta User Access Token.
Exchanges it for a long-lived token (60 days) first, then seeds both platforms.
Run: python seed_meta.py
"""
import asyncio
import uuid
from datetime import datetime, timezone, timedelta

import httpx
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL      = "mongodb://localhost:27017"
DB_NAME        = "socails"
APP_ID         = "904770415115463"
APP_SECRET     = "88cee2ba3201e5a88a143804d3d6e11c"
SHORT_TOKEN    = "EAAM24kcyPMcBRnypRrLGJ7v0q9vOMCYWhZBrVhD2GgIfeWJZAdLi9ZBouI9vu7XeaTEGZCifrTqthATZAstoEGSn7oki9kfZCO7pkcS2azLVu8vaWQM51BkcgaJiZBe3cwyYbZABmm16zt94aM0M0YRKZCC5S2dC2qQ8fDySZBitNOAKxZBjNQepZC1RsOeLT9ZAuhDd0VVaiBaPV6zjf9cpRewoZBgZCO1zoZBoh2flqmARIZChWQgNGWctpxNTLfkNfW4hXcT7xOE1rMC1PVkzvzm08VwZDZD"
IG_USER_ID     = "17841470404022447"


async def exchange_long_lived(client: httpx.AsyncClient, short_token: str) -> tuple[str, int]:
    r = await client.get(
        "https://graph.facebook.com/v19.0/oauth/access_token",
        params={
            "grant_type":        "fb_exchange_token",
            "client_id":         APP_ID,
            "client_secret":     APP_SECRET,
            "fb_exchange_token": short_token,
        },
    )
    r.raise_for_status()
    data = r.json()
    return data["access_token"], data.get("expires_in", 5_184_000)


async def fetch_ig_account(client: httpx.AsyncClient, token: str) -> dict:
    r = await client.get(
        f"https://graph.facebook.com/v19.0/{IG_USER_ID}",
        params={"fields": "id,username,name,followers_count,profile_picture_url", "access_token": token},
    )
    r.raise_for_status()
    return r.json()


async def fetch_fb_pages(client: httpx.AsyncClient, token: str) -> list:
    r = await client.get(
        "https://graph.facebook.com/v19.0/me/accounts",
        params={"fields": "id,name,category,fan_count,access_token,picture", "access_token": token},
    )
    r.raise_for_status()
    return r.json().get("data", [])


async def main():
    db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]

    async with httpx.AsyncClient(timeout=20) as client:
        # Step 1 — exchange for long-lived token
        print("Exchanging for long-lived token...")
        long_token, expires_in = await exchange_long_lived(client, SHORT_TOKEN)
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        print(f"  OK expires in {expires_in // 86400} days ({expires_at.date()})")

        # Step 2 — Instagram
        print("Fetching Instagram account...")
        ig = await fetch_ig_account(client, long_token)
        print(f"  -> @{ig.get('username')}  ({ig.get('followers_count', 0)} followers)")

        ig_doc = {
            "account_id":        str(uuid.uuid4()),
            "platform":          "instagram",
            "platform_user_id":  ig["id"],
            "username":          ig.get("username", IG_USER_ID),
            "display_name":      ig.get("name", ig.get("username", IG_USER_ID)),
            "profile_image_url": ig.get("profile_picture_url", ""),
            "followers_count":   ig.get("followers_count", 0),
            "access_token":      long_token,
            "refresh_token":     None,
            "token_expires_at":  expires_at,
            "scopes":            ["instagram_basic", "instagram_content_publish", "instagram_manage_comments"],
            "connected_at":      datetime.now(timezone.utc),
            "is_active":         True,
            "page_id":           ig["id"],
        }
        res = await db.accounts.update_one(
            {"platform": "instagram", "platform_user_id": ig["id"]},
            {"$set": ig_doc}, upsert=True,
        )
        print(f"  OK Instagram upserted (modified={res.modified_count}, new={res.upserted_id is not None})")

        # Step 3 — Facebook Pages
        print("Fetching Facebook Pages...")
        pages = await fetch_fb_pages(client, long_token)
        print(f"  Found {len(pages)} page(s)")

        for page in pages:
            page_token = page.get("access_token", long_token)
            pic_url = ""
            if isinstance(page.get("picture"), dict):
                pic_url = page["picture"].get("data", {}).get("url", "")

            fb_doc = {
                "account_id":        str(uuid.uuid4()),
                "platform":          "facebook",
                "platform_user_id":  page["id"],
                "username":          page.get("name", page["id"]),
                "display_name":      page.get("name", page["id"]),
                "profile_image_url": pic_url,
                "followers_count":   page.get("fan_count", 0),
                "access_token":      page_token,
                "refresh_token":     None,
                "token_expires_at":  None,   # page tokens don't expire
                "scopes":            ["pages_manage_posts", "pages_read_engagement", "pages_messaging"],
                "connected_at":      datetime.now(timezone.utc),
                "is_active":         True,
                "page_id":           page["id"],
            }
            res = await db.accounts.update_one(
                {"platform": "facebook", "platform_user_id": page["id"]},
                {"$set": fb_doc}, upsert=True,
            )
            print(f"  OK Facebook '{page.get('name')}' upserted (modified={res.modified_count}, new={res.upserted_id is not None})")

    print("\nDone - refresh the Account Hub.")


if __name__ == "__main__":
    asyncio.run(main())
