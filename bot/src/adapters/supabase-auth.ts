// Signs a student in against the web app's Supabase Auth, server to server.
// The bot never stores the password; it only learns which account and which
// fresh session the sign-in produced, then ends that session.

export type SignedIn = {
  userId: string;
  sessionId: string;
  accessToken: string;
};

type AuthConfig = { url: string; publishableKey: string; fetch?: typeof fetch };

function sessionIdOf(accessToken: string): string | null {
  const payload = accessToken.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as {
      session_id?: unknown;
    };
    return typeof claims.session_id === "string" ? claims.session_id : null;
  } catch {
    return null;
  }
}

export async function signIn(
  email: string,
  password: string,
  cfg: AuthConfig,
): Promise<SignedIn | null> {
  const res = await (cfg.fetch ?? fetch)(
    `${cfg.url}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: cfg.publishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!res.ok) return null;
  const body = (await res.json()) as {
    access_token?: string;
    user?: { id?: string };
  };
  const sessionId = body.access_token ? sessionIdOf(body.access_token) : null;
  if (!body.access_token || !body.user?.id || !sessionId) return null;
  return { userId: body.user.id, sessionId, accessToken: body.access_token };
}

export async function signOut(
  accessToken: string,
  cfg: AuthConfig,
): Promise<void> {
  await (cfg.fetch ?? fetch)(`${cfg.url}/auth/v1/logout?scope=local`, {
    method: "POST",
    headers: {
      apikey: cfg.publishableKey,
      Authorization: `Bearer ${accessToken}`,
    },
    signal: AbortSignal.timeout(8000),
  }).catch(() => undefined);
}
