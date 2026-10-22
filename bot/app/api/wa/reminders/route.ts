import { cronAllowed, reminderJob } from "../../../../src/adapters/wiring";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Called once a day by Vercel Cron (bot/vercel.json) with CRON_SECRET.
export async function GET(req: Request) {
  if (!cronAllowed(req.headers.get("authorization"))) return new Response(null, { status: 401 });
  return Response.json(await reminderJob(new Date()));
}
