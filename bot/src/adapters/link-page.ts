// The bot's own sign-in page. A student opens the one-time link from WhatsApp,
// signs in with their Leeway email and password, and their number is linked.
// Plain HTML, no scripts: nothing here runs in the browser.
import type { SignedIn } from "./supabase-auth";

export type Prepared = "ok" | "expired" | "no_session" | "account_taken";

export type LinkPageDeps = {
  tokenOk(token: string): Promise<boolean>;
  // Takes one of the sender's sign-in attempts; false when none are left.
  takeAttempt(token: string): Promise<boolean>;
  // Counts this attempt from the address and returns the count this hour.
  countIp(ip: string): Promise<number>;
  signIn(email: string, password: string): Promise<SignedIn | null>;
  signOut(accessToken: string): Promise<void>;
  prepare(token: string, who: SignedIn, code: string): Promise<Prepared>;
  newCode(): string;
  now?: () => number;
};

const MAX_FORM_BYTES = 4096;
const IP_LIMIT_PER_HOUR = 20;
// Failed sign-ins all take this long, so timing does not tell whether an
// email has an account.
const FAILURE_FLOOR_MS = 600;

const HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  // The token is in the address; never pass it on.
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy":
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
};

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function page(title: string, body: string, status = 200): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)} · Leeway</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:26rem;margin:3rem auto;padding:0 1rem;color:#1a1a1a}
label{display:block;margin-top:1rem}input{width:100%;padding:.6rem;font:inherit;box-sizing:border-box}
button{margin-top:1.5rem;width:100%;padding:.7rem;font:inherit;background:#1d5c4d;color:#fff;border:0;border-radius:6px}
.err{color:#a3261f}</style></head><body><h1>${escape(title)}</h1>${body}</body></html>`;
  return new Response(html, { status, headers: HEADERS });
}

function form(token: string, error?: string): Response {
  return page(
    "Connect WhatsApp",
    `<p>Sign in with your Leeway email and password to connect this WhatsApp number.</p>
${error ? `<p class="err">${escape(error)}</p>` : ""}
<form method="post"><input type="hidden" name="t" value="${escape(token)}">
<label>Email<input name="email" type="email" autocomplete="email" required maxlength="254"></label>
<label>Password<input name="password" type="password" autocomplete="current-password" required maxlength="128"></label>
<button type="submit">Connect</button></form>`,
    error ? 400 : 200,
  );
}

const expired = () =>
  page(
    "This link has expired",
    "<p>Send any message to Leeway on WhatsApp to get a new one.</p>",
    410,
  );

const simple = (title: string, text: string, status: number) =>
  page(title, `<p>${escape(text)}</p>`, status);

function codePage(code: string): Response {
  const shown = `${code.slice(0, 3)} ${code.slice(3)}`;
  return page(
    "One last step",
    `<p>Send this code to Leeway on WhatsApp, from the phone you started on:</p>
<p style="font-size:2rem;letter-spacing:.2rem;font-weight:600">${shown}</p>
<p>It works for 10 minutes. Only ever send it to Leeway, never to a person.</p>`,
  );
}

const PREPARED: Record<Exclude<Prepared, "ok">, () => Response> = {
  expired,
  no_session: () =>
    simple(
      "That didn't work",
      "Your sign-in couldn't be confirmed. Open the link again and sign in once more.",
      409,
    ),
  account_taken: () =>
    simple(
      "This account is already connected",
      "Your Leeway account is linked to another WhatsApp number. Write to Leeway from that number.",
      409,
    ),
};

export async function showLinkPage(
  url: URL,
  deps: LinkPageDeps,
): Promise<Response> {
  const token = url.searchParams.get("t") ?? "";
  if (!token || token.length > 100 || !(await deps.tokenOk(token)))
    return expired();
  return form(token);
}

const clientIp = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

export async function submitLinkPage(
  req: Request,
  deps: LinkPageDeps,
): Promise<Response> {
  const now = deps.now ?? Date.now;
  const started = now();
  const contentType = req.headers.get("content-type") ?? "";
  if (
    Number(req.headers.get("content-length") ?? 0) > MAX_FORM_BYTES ||
    !contentType.startsWith("application/x-www-form-urlencoded")
  )
    return simple(
      "That didn't work",
      "Open the link from WhatsApp again.",
      400,
    );
  const body = await req
    .arrayBuffer()
    .catch(() => new ArrayBuffer(MAX_FORM_BYTES + 1));
  if (body.byteLength > MAX_FORM_BYTES)
    return simple(
      "That didn't work",
      "Open the link from WhatsApp again.",
      400,
    );

  const data = new URLSearchParams(new TextDecoder().decode(body));
  const field = (name: string, max: number) => {
    const v = data.get(name);
    return v !== null && v.length <= max ? v : "";
  };
  const token = field("t", 100);
  const email = field("email", 254).trim();
  const password = field("password", 128);

  if ((await deps.countIp(clientIp(req))) > IP_LIMIT_PER_HOUR)
    return simple(
      "Too many tries",
      "Too many sign-in attempts from here. Try again in an hour.",
      429,
    );
  if (!token || !(await deps.tokenOk(token))) return expired();
  if (!email || !password) return form(token, "Enter your email and password.");
  if (!(await deps.takeAttempt(token)))
    return simple(
      "Too many tries",
      "Too many wrong passwords for this number today. Try again tomorrow.",
      429,
    );

  let who: SignedIn | null;
  try {
    who = await deps.signIn(email, password);
  } catch {
    return simple(
      "Leeway didn't answer",
      "Leeway couldn't check your sign-in just now. Try again in a minute.",
      503,
    );
  }
  if (!who) {
    const wait = FAILURE_FLOOR_MS - (now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    return form(token, "That email and password don't match a Leeway account.");
  }
  try {
    const code = deps.newCode();
    const result = await deps.prepare(token, who, code);
    return result === "ok" ? codePage(code) : PREPARED[result]();
  } finally {
    await deps.signOut(who.accessToken);
  }
}
