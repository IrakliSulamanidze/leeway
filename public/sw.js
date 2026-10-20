// Push only: shows the night-before alert and opens the app when it is tapped.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Leeway", {
      body: data.body || "",
      icon: "/favicon.ico",
      data: { url: "/app" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Same-origin path only, never a URL from the payload.
  const url = new URL("/app", self.location.origin).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((wins) => {
        const open = wins.find((w) => w.url.startsWith(url));
        return open ? open.focus() : self.clients.openWindow(url);
      }),
  );
});
