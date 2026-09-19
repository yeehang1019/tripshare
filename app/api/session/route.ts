import { createTripShareSession } from "@/app/session";

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

  const token = await createTripShareSession(user, email);

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
