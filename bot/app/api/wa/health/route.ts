import { dateIn, MADRID } from "@/lib/rules/dates";

export const dynamic = "force-dynamic";

// Liveness for uptime checks. Reports the Madrid date the bot would use, which
// catches a wrong server clock before it shifts a skip to the wrong day.
export function GET() {
  return Response.json({ ok: true, madridDate: dateIn(new Date(), MADRID) });
}
