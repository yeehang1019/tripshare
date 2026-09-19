import { database } from "@/db/raw";

export const dynamic = "force-dynamic";

function safeReturnTo(value: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function GET(request: Request) {
  const user = request.headers.get("oai-authenticated-user-id");
  const email = (request.headers.get("oai-authenticated-user-email") || "").toLowerCase();
  if (!user || !email) {
    return Response.json({ error: "Sign in to continue" }, { status: 401 });
  }

  const token = crypto.randomUUID() + crypto.randomUUID();
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const db = database();
  await db.batch([
    db.prepare("DELETE FROM sessions WHERE expires_at<?").bind(Date.now()),
    db.prepare("INSERT INTO sessions(token,user,email,expires_at) VALUES(?,?,?,?)").bind(token, user, email, expiresAt),
  ]);

  const destination = new URL(safeReturnTo(new URL(request.url).searchParams.get("return_to")), request.url);
  return new Response(null, {
    status: 303,
    headers: {
      Location: destination.toString(),
      "Cache-Control": "no-store",
      "Set-Cookie": `tripshare_session=${token}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}
