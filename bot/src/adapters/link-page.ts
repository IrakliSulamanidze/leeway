// The bot's own sign-in page. A student opens the one-time link from WhatsApp,
// signs in with their Leeway email and password, and their number is linked.
// Plain HTML, no scripts: nothing here runs in the browser.
import type { SignedIn } from "./supabase-auth";

export type LinkPageDeps = {
  tokenOk(token: string): Promise<boolean>;
  failed(token: string): Promise<void>;
  signIn(email: string, password: string): Promise<SignedIn | null>;
  signOut(accessToken: string): Promise<void>;
  complete(
    token: string,
    who: SignedIn,
  ): Promise<{ outcome: string; place: number | null }>;
};

const HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  // The token is in the address; never pass it on.
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
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

const RESULTS: Record<string, (place: number | null) => Response> = {
  linked: () =>
    page(
      "You're connected",
      "<p>Go back to WhatsApp and say hi to Leeway.</p>",
    ),
  waitlisted: (place) =>
    page(
      "You're on the waitlist",
      `<p>Leeway's full for now. You're number ${place ?? "?"} in line. Leeway will message you on WhatsApp when there's a place.</p>`,
    ),
  account_taken: () =>
    page(
      "This account is already connected",
      "<p>Your Leeway account is linked to another WhatsApp number. Write to Leeway from that number.</p>",
      409,
    ),
};

export async function showLinkPage(
  url: URL,
  deps: LinkPageDeps,
): Promise<Response> {
  const token = url.searchParams.get("t") ?? "";
  if (!token || !(await deps.tokenOk(token))) return expired();
  return form(token);
}

export async function submitLinkPage(
  req: Request,
  deps: LinkPageDeps,
): Promise<Response> {
  const data = await req.formData().catch(() => null);
  const field = (name: string, max: number) => {
    const v = data?.get(name);
    return typeof v === "string" && v.length <= max ? v : "";
  };
  const token = field("t", 100);
  const email = field("email", 254).trim();
  const password = field("password", 128);
  if (!token || !(await deps.tokenOk(token))) return expired();
  if (!email || !password) return form(token, "Enter your email and password.");

  const who = await deps.signIn(email, password);
  if (!who) {
    await deps.failed(token);
    return form(token, "That email and password don't match a Leeway account.");
  }
  try {
    const { outcome, place } = await deps.complete(token, who);
    return (RESULTS[outcome] ?? expired)(place);
  } finally {
    await deps.signOut(who.accessToken);
  }
}
