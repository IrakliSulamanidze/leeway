import { receive, verifySubscription } from "../../../../src/adapters/webhook";
import { verifyToken, webhookDeps } from "../../../../src/adapters/wiring";

export const dynamic = "force-dynamic";
// A reply may wait on the database and Meta; Meta expects an answer within 10 s.
export const maxDuration = 10;

export function GET(req: Request) {
  return verifySubscription(new URL(req.url), verifyToken());
}

export function POST(req: Request) {
  return receive(req, webhookDeps());
}
