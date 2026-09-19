import { database } from "@/db/raw";

export async function createTripShareSession(user: string, email: string) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const db = database();
  await db.batch([
    db.prepare("DELETE FROM sessions WHERE expires_at<?").bind(Date.now()),
    db
      .prepare("INSERT INTO sessions(token,user,email,expires_at) VALUES(?,?,?,?)")
      .bind(token, user, email.toLowerCase(), expiresAt),
  ]);
  return token;
}
