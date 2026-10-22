// Builds the production dependencies once per server instance.
import { processInbound } from "../core/inbound";
import { systemClock } from "./clock";
import { sharedPool } from "./db";
import { dbAccounts, tokenHash } from "./db-accounts";
import { dbGate } from "./db-gate";
import { env } from "./env";
import type { LinkPageDeps } from "./link-page";
import { cloudApiMessenger } from "./meta/cloud-api";
import { signIn, signOut } from "./supabase-auth";
import type { WebhookDeps } from "./webhook";

let deps: WebhookDeps | undefined;
let linkDeps: LinkPageDeps | undefined;

export function webhookDeps(): WebhookDeps {
  if (deps) return deps;
  const gate = dbGate(env.hashKey());
  const accounts = dbAccounts(env.publicUrl());
  deps = {
    appSecret: env.appSecret(),
    inbox: gate,
    messenger: cloudApiMessenger(env.phoneNumberId(), env.accessToken()),
    process: (msg) =>
      processInbound(msg, { clock: systemClock, gate, accounts }),
  };
  return deps;
}

export function linkPageDeps(): LinkPageDeps {
  if (linkDeps) return linkDeps;
  const auth = {
    url: env.supabaseUrl(),
    publishableKey: env.supabasePublishableKey(),
  };
  const db = () => sharedPool();
  linkDeps = {
    async tokenOk(token) {
      const { rows } = await db().query(
        "select wa_api.link_token_ok($1) as ok",
        [tokenHash(token)],
      );
      return rows[0]?.ok === true;
    },
    async failed(token) {
      await db().query("select wa_api.link_failed($1)", [tokenHash(token)]);
    },
    signIn: (email, password) => signIn(email, password, auth),
    signOut: (accessToken) => signOut(accessToken, auth),
    async complete(token, who) {
      const { rows } = await db().query(
        "select outcome, place from wa_api.complete_link($1, $2, $3)",
        [tokenHash(token), who.userId, who.sessionId],
      );
      return rows[0] as { outcome: string; place: number | null };
    },
  };
  return linkDeps;
}

export const verifyToken = () => env.verifyToken();
