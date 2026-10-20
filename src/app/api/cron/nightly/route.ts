import { timingSafeEqual } from "node:crypto";
import { syncFeed } from "@/lib/calendar/sync";
import { createAdminClient } from "@/lib/server/admin";
import { runNightly } from "@/lib/server/nightly";

// Vercel Cron calls this at 19:00 and 20:00 UTC; the job runs only at 21:xx Madrid.
export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(header: string | null, secret: string): boolean {
  const got = Buffer.from(header ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  // Unset or short: refuse, so "Bearer undefined" can never pass.
  if (!secret || secret.length < 32)
    return Response.json({ error: "not configured" }, { status: 500 });
  if (!authorized(request.headers.get("authorization"), secret))
    return Response.json({ error: "unauthorized" }, { status: 401 });
  const result = await runNightly({
    db: createAdminClient(),
    syncFeed: (db, feedId, userId, getUrl) =>
      syncFeed(db, feedId, userId, getUrl, undefined, undefined, {
        admin: true,
      }),
  });
  return Response.json(result);
}
