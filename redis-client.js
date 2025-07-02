import "dotenv/config";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL, { tls: {} });

redis.on("connect", () => {
  console.log("Connected to Upstash Redis!");
});

redis.on("error", (err) => {
  console.error("Redis connection error:", err);
});

export default redis;