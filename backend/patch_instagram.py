import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def fix():
    db = AsyncIOMotorClient("mongodb://localhost:27017")["socails"]
    result = await db.accounts.update_one(
        {"platform": "instagram", "platform_user_id": "17841470404022447"},
        {"$set": {
            "username": "charged.up.ai",
            "display_name": "Vinayak Gaur",
            "followers_count": 7,
            "profile_picture_url": "https://scontent.fpnq15-1.fna.fbcdn.net/v/t51.2885-15/468948087_1584399532444997_2619529356031917792_n.jpg",
        }}
    )
    print("modified:", result.modified_count)

asyncio.run(fix())
