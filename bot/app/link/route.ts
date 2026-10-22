import { showLinkPage, submitLinkPage } from "../../src/adapters/link-page";
import { linkPageDeps } from "../../src/adapters/wiring";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return showLinkPage(new URL(req.url), linkPageDeps());
}

export function POST(req: Request) {
  return submitLinkPage(req, linkPageDeps());
}
