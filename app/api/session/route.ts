import {timedJSON} from '@/lib/response-metrics';
import { createTripShareSession } from "@/app/session";

export const dynamic = "force-dynamic";

export function safeReturnTo(value: string | null, base = "https://tripshare.invalid") {
  // Browsers treat "\" like "/", so "/\evil.example" would leave the site. Resolve and require same origin.
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  try {
    const resolved = new URL(value, base);
    if (resolved.origin !== new URL(base).origin) return "/";
    return resolved.pathname + resolved.search + resolved.hash;
  } catch {
    return "/";
  }
}

export async function GET(request: Request) {
  const user = request.headers.get("oai-authenticated-user-id");
  const email = (request.headers.get("oai-authenticated-user-email") || "").toLowerCase();
  if (!user || !email) {
    return timedJSON({ error: "Sign in to continue" }, { status: 401 });
  }

  const token = await createTripShareSession(user, email);

  const destination = new URL(safeReturnTo(new URL(request.url).searchParams.get("return_to"), request.url), request.url);
  return new Response(null, {
    status: 303,
    headers: {
      Location: destination.toString(),
      "Cache-Control": "no-store",
      "Set-Cookie": `tripshare_session=${token}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}
