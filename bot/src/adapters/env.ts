// The bot's configuration, read only here (scripts/boundaries.mjs enforces it).
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export const env = {
  appSecret: () => required("WHATSAPP_APP_SECRET"),
  verifyToken: () => required("WHATSAPP_VERIFY_TOKEN"),
  accessToken: () => required("WHATSAPP_ACCESS_TOKEN"),
  phoneNumberId: () => required("WHATSAPP_PHONE_NUMBER_ID"),
  hashKey: () => required("WA_HASH_KEY"),
  // Optional: without it the bot answers commands and buttons only.
  anthropicKey: () => process.env.ANTHROPIC_API_KEY || null,
  // Public values: the Supabase project the web app uses, and this bot's address.
  supabaseUrl: () => required("SUPABASE_URL"),
  supabasePublishableKey: () => required("SUPABASE_PUBLISHABLE_KEY"),
  publicUrl: () => required("BOT_PUBLIC_URL"),
  // Sent by the scheduler (Vercel Cron) as a bearer token.
  cronSecret: () => required("CRON_SECRET"),
  // "true" once Meta has approved the reminder templates.
  templatesReady: () => process.env.WA_TEMPLATES_READY === "true",
};
