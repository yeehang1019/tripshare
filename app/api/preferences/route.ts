import {timedJSON} from '@/lib/response-metrics';
import { database } from "@/db/raw";

export const dynamic = "force-dynamic";

const response = (data: unknown, status = 200) => timedJSON(data, {
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
    .prepare("SELECT palette,mode,motion,lighting_explicit FROM user_preferences WHERE user=?")
    .bind(who.user)
    .first();
  return response({palette:row?.palette||"cyberpunk",mode:row?.lighting_explicit===1?row.mode:"system",motion:row?.motion||"smooth",lightingExplicit:row?.lighting_explicit===1});
}

export async function POST(request: Request) {
  const who = await identity(request);
  if (!who) return response({ error: "Sign in to save appearance" }, 401);
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin)
    return response({ error: "Invalid origin" }, 403);
  let body:any;try{body=await request.json()}catch{return response({error:"Invalid appearance preference"},400)}
  if(!body||typeof body!=="object"||Array.isArray(body)||body.lightingChanged!==undefined&&typeof body.lightingChanged!=="boolean")return response({error:"Invalid appearance preference"},400);
  const palettes = ["cyberpunk", "cozy", "plum", "abyss", "sahara", "northern", "kodak", "amazon", "interstellar", "kyoto"];
  const modes = ["system", "light", "night"];
  const motions = ["full", "smooth", "battery"];
  if (!palettes.includes(body.palette) || !modes.includes(body.mode) || !motions.includes(body.motion))
    return response({ error: "Invalid appearance preference" }, 400);
  await database()
    .prepare("INSERT INTO user_preferences(user,email,palette,mode,motion,lighting_explicit,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user) DO UPDATE SET email=excluded.email,palette=excluded.palette,mode=CASE WHEN excluded.lighting_explicit=1 THEN excluded.mode WHEN user_preferences.lighting_explicit=1 THEN user_preferences.mode ELSE 'system' END,motion=excluded.motion,lighting_explicit=MAX(user_preferences.lighting_explicit,excluded.lighting_explicit),updated_at=excluded.updated_at")
    .bind(who.user, who.email, body.palette, body.lightingChanged?body.mode:"system", body.motion, body.lightingChanged?1:0, Date.now())
    .run();
  return response({ ok: true });
}
