// The pilot runner: the same bot on an ordinary WhatsApp number, through the
// unofficial Baileys client. It stays connected, answers messages and sends
// the daily reminders. See docs/bot/pilot.md; this breaks WhatsApp's terms
// and the number can be banned.
//   npm run pilot
import { randomInt } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import makeWASocket, {
  type WAMessage,
  type WASocket,
  DisconnectReason,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import { madridToday } from "@/lib/rules/dates";
import { processInbound } from "../../core/inbound";
import { CODE_ALPHABET } from "../../core/intents/share";
import type { InboundDeps, Messenger } from "../../ports";
import { anthropicClient, claudeReader } from "../claude/reader";
import { systemClock } from "../clock";
import { countingMessenger } from "../counting";
import { inTurn, sharedPool } from "../db";
import { dbAccounts } from "../db-accounts";
import { dbGate } from "../db-gate";
import { dbSharing } from "../db-sharing";
import { dbStudent } from "../db-student";
import { keyedHash } from "../hash";
import { log } from "../log";
import { ScriptedReader } from "../memory-reader";
import { runReminders } from "../reminders-job";
import { NumberedMenus, toInbound, toText } from "./translate";

const SESSION_DIR =
  process.env.WA_SESSION_DIR || join(homedir(), ".leeway-whatsapp-session");
const PAIR_NUMBER = process.env.WA_PILOT_NUMBER?.replace(/\D/g, "") || null;
const hashKey = process.env.WA_HASH_KEY;
if (!hashKey) throw new Error("WA_HASH_KEY is not set");

// Baileys logs a great deal; the bot keeps only warnings and errors, without
// message content.
const quiet = {
  level: "warn",
  child: () => quiet,
  trace: () => undefined,
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: (obj: unknown) =>
    log.error("baileys", obj instanceof Error ? obj.name : "error"),
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const call = async (sql: string, params: unknown[] = []) =>
  (await sharedPool().query(sql, params)).rows[0];
const budget = {
  left: async () =>
    (await call("select wa_api.ai_budget_left() as ok"))?.ok === true,
  spend: async (micros: number) =>
    void (await call("select wa_api.add_ai_spend($1)", [micros])),
};

const gate = dbGate(hashKey);
const accounts = dbAccounts("https://leeway.invalid", hashKey);
const student = dbStudent(hashKey);
const menus = new NumberedMenus();

// The socket in use. A reconnect replaces it, so senders read it on each send.
let current: WASocket | null = null;

// Plain text only; a pause before each reply so the account reads less like
// a script.
const raw: Messenger = {
  async send(to, reply) {
    if (!current) throw new Error("not connected");
    await current.sendPresenceUpdate("composing", to).catch(() => undefined);
    await sleep(800 + randomInt(1200));
    await current.sendMessage(to, { text: toText(reply) });
  },
  async sendTemplate() {
    throw new Error("an ordinary number has no templates");
  },
};
const messenger = countingMessenger(
  raw,
  async () => void (await call("select wa_api.count_sent()")),
);

const deps: InboundDeps = {
  clock: systemClock,
  gate,
  accounts,
  student,
  reader: process.env.ANTHROPIC_API_KEY
    ? claudeReader(anthropicClient(process.env.ANTHROPIC_API_KEY), budget)
    : new ScriptedReader(),
  speech: { transcribe: async () => ({ ok: false, reason: "off" }) },
  sharing: dbSharing(hashKey!),
  newCode: () =>
    Array.from(
      { length: 8 },
      () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
    ).join(""),
  manualLinking: true,
};

async function start(): Promise<void> {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const sock = makeWASocket({
    auth: state,
    logger: quiet,
    markOnlineOnConnect: false,
  });
  current = sock;
  sock.ev.on("creds.update", saveCreds);

  // WhatsApp sends a new QR every 20 seconds while unpaired; a new pairing
  // code each time would cancel the one being typed.
  let pairing = false;
  sock.ev.on(
    "connection.update",
    async ({ connection, lastDisconnect, qr }) => {
      try {
        if (qr && !state.creds.registered && !pairing) {
          pairing = true;
          if (!PAIR_NUMBER) {
            log.error("pilot: set WA_PILOT_NUMBER to pair this number");
            process.exit(1);
          }
          const code = await sock.requestPairingCode(PAIR_NUMBER);
          process.stdout.write(
            `\nOn the pilot phone: WhatsApp, Linked devices, Link with phone number, and enter: ${code}\n`,
          );
        }
        if (connection === "open") process.stdout.write("pilot: connected\n");
        if (connection === "close") {
          const status = (
            lastDisconnect?.error as
              { output?: { statusCode?: number } } | undefined
          )?.output?.statusCode;
          if (status === DisconnectReason.loggedOut) {
            // Exit 0 so systemd does not restart into the same dead session.
            log.error(
              "pilot: logged out by WhatsApp; delete the session folder and pair again",
            );
            process.exit(0);
          }
          log.warn(
            "pilot: connection closed, reconnecting",
            String(status ?? ""),
          );
          setTimeout(() => void connect(), 3000);
        }
      } catch (error) {
        log.error("pilot: connection handling failed", nameOf(error));
      }
    },
  );

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    // 'append' is what came in while the bot was offline; anything more than
    // a day old is dropped by processInbound.
    if (type !== "notify" && type !== "append") return;
    for (const m of messages) {
      const incoming = await incomingOf(sock, m);
      if (!incoming) continue;
      try {
        if (!(await gate.claim(incoming.msg.id))) continue;
        const msg = menus.resolve(incoming.msg, Date.now());
        const replies = await processInbound(msg, deps);
        for (const reply of replies)
          await messenger.send(incoming.replyTo, reply);
        menus.remember(msg.from, replies, Date.now());
        await gate.finish(incoming.msg.id);
      } catch (error) {
        log.error(
          "pilot: message failed",
          error instanceof Error ? error.name : "unknown",
        );
        await gate.finish(incoming.msg.id).catch(() => undefined);
      }
    }
  });
}

// A chat known only by its LID, without the phone number alongside, is looked
// up in Baileys' own LID-to-phone map before it is given up on.
async function incomingOf(sock: WASocket, m: WAMessage) {
  const now = new Date();
  const first = toInbound(m, now);
  const { remoteJid, remoteJidAlt } = m.key;
  if (first || !remoteJid?.endsWith("@lid") || remoteJidAlt || m.key.fromMe)
    return first;
  const pn = await sock.signalRepository.lidMapping
    .getPNForLID(remoteJid)
    .catch(() => null);
  const found = pn
    ? toInbound({ ...m, key: { ...m.key, remoteJidAlt: pn } }, now)
    : null;
  if (!found) log.warn("pilot: message from an unknown LID skipped");
  return found;
}

const nameOf = (error: unknown) =>
  error instanceof Error ? error.name : "unknown";

// Connects, and tries again in a minute when even that fails.
async function connect() {
  try {
    await start();
  } catch (error) {
    log.error("pilot: could not connect", nameOf(error));
    setTimeout(() => void connect(), 60_000);
  }
}

// Once a day at 20:00 in Madrid, the same reminders as the Cloud API path,
// all as plain text.
function startReminders() {
  let lastRun = "";
  setInterval(async () => {
    const now = new Date();
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Madrid",
        hour: "2-digit",
        hourCycle: "h23",
      }).format(now),
    );
    const today = madridToday(now);
    if (hour !== 20 || lastRun === today) return;
    lastRun = today;
    const secret = process.env.CRON_SECRET ?? "";
    const result = await runReminders({
      now,
      targets: async () =>
        (
          await sharedPool().query(
            "select wa_id, last_inbound_at from wa_api.reminder_targets($1)",
            [secret],
          )
        ).rows.map((r) => ({
          waId: r.wa_id as string,
          lastSeenAt: (r.last_inbound_at as Date | null) ?? null,
        })),
      optedOut: async (waId) =>
        (
          await call("select wa_api.opted_out($1) as out", [
            keyedHash(waId, hashKey!),
          ])
        )?.out === true,
      claim: (waId) =>
        inTurn(
          waId,
          async (tx) =>
            (await tx.query("select wa_api.claim_reminder() as ok")).rows[0]
              ?.ok === true,
        ),
      unclaim: async (waId) =>
        void (await inTurn(waId, (tx) =>
          tx.query("select wa_api.unclaim_reminder()"),
        )),
      student,
      accounts,
      // Reminders go to the phone number; the numbers are linked by hand.
      messenger: {
        ...messenger,
        send: (to, reply) => messenger.send(`${to}@s.whatsapp.net`, reply),
      },
      templatesReady: false,
      textOnly: true,
    }).catch((error: unknown) => {
      log.error(
        "pilot: reminders failed",
        error instanceof Error ? error.name : "unknown",
      );
      return null;
    });
    if (result)
      process.stdout.write(`pilot: reminders ${JSON.stringify(result)}\n`);
  }, 60_000);
}

process.on("unhandledRejection", (error) =>
  log.error("pilot: unhandled", nameOf(error)),
);
startReminders();
void connect();
