import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL;
let redis;

function getRedis() {
  if (!redis) {
    redis = new Redis(REDIS_URL, { tls: {} });
  }
  return redis;
}

function getSessionKey(token) {
  return `session:${token}`;
}

export async function GET(request) {
  if (!REDIS_URL) {
    return Response.json({ success: false, message: "Missing REDIS_URL env var" }, { status: 500 });
  }

  const redisClient = getRedis();

  // Parse cookies from header
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader
      .split(";")
      .map(c => c.trim().split("="))
      .filter(parts => parts.length === 2)
  );

  const sessionToken = cookies.session;

  if (!sessionToken) {
    return Response.json({ success: false, message: "No session cookie found" }, { status: 401 });
  }

  try {
    const email = await redisClient.get(getSessionKey(sessionToken));

    if (!email) {
      return Response.json({ success: false, message: "Invalid or expired session" }, { status: 401 });
    }

    return Response.json({ success: true, email }, { status: 200 });
  } catch (err) {
    console.error("Redis error:", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}