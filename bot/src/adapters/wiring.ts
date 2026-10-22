// Builds the production dependencies once per server instance.
import { processInbound } from "../core/inbound";
import { systemClock } from "./clock";
import { dbGate } from "./db-gate";
import { env } from "./env";
import { cloudApiMessenger } from "./meta/cloud-api";
import type { WebhookDeps } from "./webhook";

let deps: WebhookDeps | undefined;

export function webhookDeps(): WebhookDeps {
  if (deps) return deps;
  const gate = dbGate(env.hashKey());
  deps = {
    appSecret: env.appSecret(),
    inbox: gate,
    messenger: cloudApiMessenger(env.phoneNumberId(), env.accessToken()),
    process: (msg) => processInbound(msg, { clock: systemClock, gate }),
  };
  return deps;
}

export const verifyToken = () => env.verifyToken();
