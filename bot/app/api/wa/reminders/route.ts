import {
  budgetAlert,
  cronAllowed,
  reminderJob,
} from "../../../../src/adapters/wiring";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Called once a day by Vercel Cron (bot/vercel.json) with CRON_SECRET: the
// reminders, then the monthly watch on Meta's bill.
export async function GET(req: Request) {
  if (!cronAllowed(req.headers.get("authorization")))
    return new Response(null, { status: 401 });
  const reminders = await reminderJob(new Date());
  const metaAlert = await budgetAlert();
  return Response.json({ reminders, metaAlert });
}
