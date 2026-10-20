"use client";

import { useEffect, useState } from "react";
import { savePushSubscription } from "@/app/app/settings/push-actions";
import { APP_NAME } from "@/lib/config";

type State =
  "loading" | "off" | "on" | "busy" | "blocked" | "iphone" | "none" | "failed";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function supported() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function isIphoneBrowserTab() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  return ios && !standalone;
}

// Reads the current state without prompting.
async function currentState(): Promise<State> {
  if (!VAPID_PUBLIC_KEY) return "none";
  if (!supported()) return isIphoneBrowserTab() ? "iphone" : "none";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted") return "off";
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ? "on" : "off";
}

// Never asks for permission on load: only inside the "Turn on alerts" tap.
export function AlertsSetting() {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    currentState()
      .then(setState)
      .catch(() => setState("off"));
  }, []);

  async function turnOn() {
    if (state === "busy") return;
    setState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState("blocked");
      const reg = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(VAPID_PUBLIC_KEY),
        }));
      const keys = sub.toJSON().keys ?? {};
      const res = await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: keys.p256dh ?? "",
        auth: keys.auth ?? "",
      });
      setState(res.ok ? "on" : "failed");
    } catch {
      setState("failed");
    }
  }

  const help: Partial<Record<State, string>> = {
    iphone: `On iPhone, add ${APP_NAME} to your Home Screen first. Safari only sends alerts to apps there.`,
    blocked: `Notifications are blocked for ${APP_NAME}. Allow them in your browser's site settings, then try again.`,
    none: "This browser can't show alerts.",
    failed: "Couldn't save. Check your connection and try again.",
  };
  return (
    <div className="grid gap-2.5">
      <div>
        Night-before alert
        <span className="block text-[13.5px] text-muted">
          Turn on alerts. One message the night before a risky day, never more.
        </span>
      </div>
      {state === "on" ? (
        <p role="status" className="m-0 text-[15px] font-semibold">
          Alerts are on.
        </p>
      ) : state === "off" || state === "busy" || state === "failed" ? (
        <button
          type="button"
          data-testid="alerts-on"
          aria-disabled={state === "busy"}
          onClick={turnOn}
          className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-primary px-5 text-[17px] font-semibold text-on-primary"
        >
          Turn on alerts
        </button>
      ) : null}
      {help[state] ? (
        <p className="m-0 text-[13.5px] text-muted" role="status">
          {help[state]}
        </p>
      ) : null}
      {state !== "iphone" ? (
        <p className="m-0 text-[13.5px] text-muted">{help.iphone}</p>
      ) : null}
    </div>
  );
}
