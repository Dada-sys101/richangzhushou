self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "日常助手提醒", {
      body: data.body || "你有一项提醒待处理",
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url: data.url || "/reminders" },
      tag: data.tag,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requestedPath = event.notification.data?.url;
  let targetUrl = new URL("/reminders", self.location.origin);
  if (typeof requestedPath === "string" && requestedPath.startsWith("/")) {
    try {
      const candidate = new URL(requestedPath, self.location.origin);
      if (
        candidate.origin === self.location.origin &&
        !requestedPath.includes("\\")
      ) {
        targetUrl = candidate;
      }
    } catch {
      // Keep the safe reminder fallback for malformed notification data.
    }
  }
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((client) =>
          client.url.startsWith(self.location.origin),
        );
        if (existing) {
          return existing.focus().then(() => existing.navigate(targetUrl.href));
        }
        return self.clients.openWindow(targetUrl.href);
      }),
  );
});
