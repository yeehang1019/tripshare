import { database } from "@/db/raw";

export const dynamic = "force-dynamic";

const response = (data: unknown, status = 200) => Response.json(data, {
  status,
  headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
});

async function identity(request: Request) {
  const headerUser = request.headers.get("oai-authenticated-user-id") || "";
  const headerEmail = (request.headers.get("oai-authenticated-user-email") || "").toLowerCase();
  if (headerUser && headerEmail) return { user: headerUser, email: headerEmail };
  const cookieToken = (request.headers.get("cookie") || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("tripshare_session="))
    ?.slice("tripshare_session=".length) || "";
  const token = request.headers.get("x-tripshare-session") || cookieToken;
  if (!token) return null;
  const row: any = await database()
    .prepare("SELECT user,email FROM sessions WHERE token=? AND expires_at>?")
    .bind(token, Date.now())
    .first();
  return row ? { user: row.user as string, email: row.email as string } : null;
}

export async function GET(request: Request) {
  const who = await identity(request);
  if (!who) return response({ error: "Sign in to load appearance" }, 401);
  const row: any = await database()
    .prepare("SELECT palette,mode,motion FROM user_preferences WHERE user=?")
    .bind(who.user)
    .first();
  return response(row || { palette: "neon", mode: "light", motion: "smooth" });
}

export async function POST(request: Request) {
  const who = await identity(request);
  if (!who) return response({ error: "Sign in to save appearance" }, 401);
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin)
    return response({ error: "Invalid origin" }, 403);
  const body = await request.json();
  const palettes = ["neon", "mono", "sky", "crimson", "warm"];
  const modes = ["light", "night"];
  const motions = ["full", "smooth", "battery"];
  if (!palettes.includes(body.palette) || !modes.includes(body.mode) || !motions.includes(body.motion))
    return response({ error: "Invalid appearance preference" }, 400);
  await database()
    .prepare("INSERT INTO user_preferences(user,email,palette,mode,motion,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user) DO UPDATE SET email=excluded.email,palette=excluded.palette,mode=excluded.mode,motion=excluded.motion,updated_at=excluded.updated_at")
    .bind(who.user, who.email, body.palette, body.mode, body.motion, Date.now())
    .run();
  return response({ ok: true });
}
