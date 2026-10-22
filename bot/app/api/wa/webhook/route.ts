import { receive, verifySubscription } from "../../../../src/adapters/webhook";
import { verifyToken, webhookDeps } from "../../../../src/adapters/wiring";

export const dynamic = "force-dynamic";
// Meta expects an answer within about 10 s; the webhook stops starting new
// messages well before, and this leaves room to finish one in progress
// instead of being cut off mid-message.
export const maxDuration = 20;

export function GET(req: Request) {
  return verifySubscription(new URL(req.url), verifyToken());
}

export function POST(req: Request) {
  return receive(req, webhookDeps());
}
