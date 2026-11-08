self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = {};
  }

  const requestedUrl = safeIrrigationUrl(payload.data?.url);
  const title = safeText(payload.title, 80) || 'Irrigation terminée';
  const body = safeText(payload.body, 160) || 'Fermez la vanne et confirmez la fin dans le module.';
  const tag = safeText(payload.tag, 180) || 'irrigation-finished';

  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag,
    renotify: true,
    requireInteraction: true,
    data: { url: requestedUrl },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const requestedUrl = safeIrrigationUrl(event.notification.data?.url);
  const targetUrl = new URL(requestedUrl, self.location.origin).href;
  event.waitUntil(openIrrigationWindow(targetUrl));
});

/**
 * Le premier plan d'abord, la page ensuite. Le téléphone n'accorde le droit
 * d'amener le module devant que quelques secondes après le toucher : attendre
 * d'abord le chargement de la page, long ou bloqué sur un onglet endormi,
 * laissait le toucher sans effet (recette réelle de la 5 quinquies,
 * 6 novembre 2026). Si la fenêtre ouverte ne peut pas changer de page, elle
 * reste devant telle quelle ; s'il n'y en a pas, ou si elle refuse de venir
 * devant, une nouvelle s'ouvre.
 */
async function openIrrigationWindow(targetUrl) {
  const windows = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });
  const existingWindow = windows.find((client) => {
    try {
      return new URL(client.url).origin === self.location.origin;
    } catch {
      return false;
    }
  });

  if (existingWindow) {
    let focusedWindow = null;
    try {
      focusedWindow = await existingWindow.focus();
    } catch {
      focusedWindow = null;
    }
    if (focusedWindow) {
      if (focusedWindow.url !== targetUrl && 'navigate' in focusedWindow) {
        try {
          await focusedWindow.navigate(targetUrl);
        } catch {
          // La fenêtre est déjà devant ; elle garde sa page.
        }
      }
      return;
    }
  }
  try {
    await self.clients.openWindow(targetUrl);
  } catch {
    // Rien d'autre à tenter depuis le service worker.
  }
}

// `/irrigation` et ses pages (3.8, docs/feature-selection-contract.md, section 5).
const IRRIGATION_PATH = /^\/irrigation(?:\/[a-z][a-z-]{0,39})?$/;

function safeIrrigationUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return '/irrigation';
  }
  try {
    const url = new URL(value, self.location.origin);
    if (url.origin !== self.location.origin || !IRRIGATION_PATH.test(url.pathname)) {
      return '/irrigation';
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/irrigation';
  }
}

function safeText(value, maximumLength) {
  return typeof value === 'string' && value.length <= maximumLength
    ? value.trim()
    : '';
}
