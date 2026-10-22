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
};
