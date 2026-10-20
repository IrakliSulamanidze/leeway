// POST /api/calendar/sync {feedId}: syncs one of the logged-in student's feeds.
// The feed link is read through feed_url_for_sync (own feeds only) and never returned.
import { syncFeed } from "@/lib/calendar/sync";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    feedId?: unknown;
  } | null;
  const feedId = typeof body?.feedId === "string" ? body.feedId : "";
  if (!UUID.test(feedId))
    return Response.json({ error: "Unknown calendar." }, { status: 400 });

  const result = await syncFeed(db, feedId, user.id, async () => {
    const { data, error } = await db.rpc("feed_url_for_sync", {
      p_feed: feedId,
    });
    return error ? null : (data as string | null);
  });
  return Response.json(result, {
    status: result.status === "busy" ? 409 : 200,
  });
}
