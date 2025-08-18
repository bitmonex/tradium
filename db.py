from motor.motor_asyncio import AsyncIOMotorClient
import redis

MONGO_URI = "mongodb://localhost:27017"
client = AsyncIOMotorClient(MONGO_URI)
db = client["tradium_db"]

REDIS_URI = "redis://localhost"
redis_client = redis.Redis.from_url(REDIS_URI, decode_responses=True)