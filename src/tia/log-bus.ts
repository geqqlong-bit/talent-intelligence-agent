// @ts-nocheck
const listeners = new Set();
const history = [];
const MAX_HISTORY = 200;

function pushHistory(event) {
  history.push(event);
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }
}

export function publishLog(event = {}) {
  const enriched = {
    timestamp: new Date().toISOString(),
    level: event.level || 'info',
    type: event.type || 'tia.event',
    message: event.message || '',
    payload: event.payload || {}
  };

  pushHistory(enriched);

  for (const listener of listeners) {
    try {
      listener(enriched);
    } catch {
      // Ignore listener failures so one broken socket does not break the bus.
    }
  }

  return enriched;
}

export function subscribeLogs(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLogHistory() {
  return [...history];
}
