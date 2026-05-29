from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING
import os

_client = None
_db = None


async def connect_db():
    global _client, _db
    _client = AsyncIOMotorClient(os.getenv("MONGO_URL", "mongodb://localhost:27017"))
    _db = _client[os.getenv("DB_NAME", "socails")]
    await _ensure_indexes()


async def disconnect_db():
    if _client:
        _client.close()


async def _ensure_indexes():
    # oauth_states: expire after 10 minutes
    await _db.oauth_states.create_index("created_at", expireAfterSeconds=600)
    await _db.oauth_states.create_index("state", unique=True)

    await _db.accounts.create_index("account_id", unique=True)
    await _db.accounts.create_index(
        [("platform", ASCENDING), ("platform_user_id", ASCENDING)], unique=True
    )

    await _db.api_keys.create_index("key_hash", unique=True)

    await _db.posts.create_index("post_id", unique=True)
    await _db.posts.create_index(
        [("scheduled_at", ASCENDING), ("status", ASCENDING)]
    )

    await _db.inbox_items.create_index("item_id", unique=True)
    await _db.inbox_items.create_index(
        [("status", ASCENDING), ("received_at", ASCENDING)]
    )

    await _db.webhooks.create_index("webhook_id", unique=True)
    await _db.media.create_index("media_id", unique=True)


def get_db():
    return _db
