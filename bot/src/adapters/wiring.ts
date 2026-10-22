// Builds the production dependencies once per server instance.
import { processInbound } from "../core/inbound";
import { systemClock } from "./clock";
import { inTurn, sharedPool } from "./db";
import { randomInt } from "node:crypto";
import { codeHash, dbAccounts, tokenHash } from "./db-accounts";
import { dbGate } from "./db-gate";
import { dbStudent } from "./db-student";
import { anthropicClient, claudeReader } from "./claude/reader";
import { ScriptedReader } from "./memory-reader";
import { env } from "./env";
import { keyedHash } from "./hash";
import type { LinkPageDeps, Prepared } from "./link-page";
import { cloudApiMessenger } from "./meta/cloud-api";
import { sameToken } from "./meta/signature";
import { type JobResult, runReminders } from "./reminders-job";
import { signIn, signOut } from "./supabase-auth";
import type { WebhookDeps } from "./webhook";

let deps: WebhookDeps | undefined;
let linkDeps: LinkPageDeps | undefined;

export function webhookDeps(): WebhookDeps {
  if (deps) return deps;
  const gate = dbGate(env.hashKey());
  const accounts = dbAccounts(env.publicUrl(), env.hashKey());
  const student = dbStudent(env.hashKey());
  const key = env.anthropicKey();
  const reader = key
    ? claudeReader(anthropicClient(key), {
        left: async () =>
          (await sharedPool().query("select wa_api.ai_budget_left() as ok"))
            .rows[0]?.ok === true,
        spend: async (micros) => {
          await sharedPool().query("select wa_api.add_ai_spend($1)", [micros]);
        },
      })
    : new ScriptedReader();
  deps = {
    appSecret: env.appSecret(),
    inbox: gate,
    messenger: cloudApiMessenger(env.phoneNumberId(), env.accessToken()),
    process: (msg) =>
      processInbound(msg, {
        clock: systemClock,
        gate,
        accounts,
        student,
        reader,
      }),
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
  const hashKey = env.hashKey();
  const call = async (sql: string, params: unknown[]) =>
    (await db().query(sql, params)).rows[0];
  linkDeps = {
    tokenOk: async (token) =>
      (await call("select wa_api.link_token_ok($1) as ok", [tokenHash(token)]))
        ?.ok === true,
    takeAttempt: async (token) =>
      (
        await call("select wa_api.take_link_attempt($1) as ok", [
          tokenHash(token),
        ])
      )?.ok === true,
    countIp: async (ip) =>
      (
        await call("select wa_api.count_ip_attempt($1) as n", [
          keyedHash(`ip:${ip}`, hashKey),
        ])
      )?.n as number,
    signIn: (email, password) => signIn(email, password, auth),
    signOut: (accessToken) => signOut(accessToken, auth),
    prepare: async (token, who, code) =>
      (
        await call("select wa_api.prepare_link($1, $2, $3, $4) as outcome", [
          tokenHash(token),
          who.userId,
          who.sessionId,
          codeHash(code, hashKey),
        ])
      )?.outcome as Prepared,
    newCode: () => String(randomInt(0, 1_000_000)).padStart(6, "0"),
  };
  return linkDeps;
}

export function reminderJob(now: Date): Promise<JobResult> {
  const hashKey = env.hashKey();
  const call = async (sql: string, params: unknown[]) =>
    (await sharedPool().query(sql, params)).rows;
  return runReminders({
    now,
    targets: async () =>
      (
        await call(
          "select wa_id, last_seen_at from wa_api.reminder_targets($1)",
          [env.cronSecret()],
        )
      ).map((r) => ({
        waId: r.wa_id as string,
        lastSeenAt: (r.last_seen_at as Date | null) ?? null,
      })),
    optedOut: async (waId) =>
      (
        await call("select wa_api.opted_out($1) as out", [
          keyedHash(waId, hashKey),
        ])
      )[0]?.out === true,
    claim: (waId) =>
      inTurn(
        waId,
        async (tx) =>
          (await tx.query("select wa_api.claim_reminder() as ok")).rows[0]
            ?.ok === true,
      ),
    student: dbStudent(hashKey),
    accounts: dbAccounts(env.publicUrl(), hashKey),
    messenger: cloudApiMessenger(env.phoneNumberId(), env.accessToken()),
    templatesReady: env.templatesReady(),
  });
}

export const cronAllowed = (header: string | null) =>
  sameToken(header?.replace(/^Bearer /, "") ?? null, env.cronSecret());

export const verifyToken = () => env.verifyToken();
