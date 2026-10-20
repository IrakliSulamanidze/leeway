// Push services a subscription endpoint may point at. Anything else is refused
// when saving and never fetched by the nightly job (it would be a server fetch
// to a host the student chose).
const EXACT = ["fcm.googleapis.com"];
const SUFFIXES = [
  ".push.services.mozilla.com",
  ".push.apple.com",
  ".notify.windows.com",
];

export function isPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port || url.username || url.password)
    return false;
  const host = url.hostname.toLowerCase();
  return EXACT.includes(host) || SUFFIXES.some((s) => host.endsWith(s));
}
