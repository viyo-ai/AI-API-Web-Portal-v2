const BENIGN_RESIZE_OBSERVER_MESSAGES = new Set([
  "ResizeObserver loop completed with undelivered notifications.",
  "ResizeObserver loop limit exceeded",
]);

export function isBenignResizeObserverLoopError(message: unknown) {
  return typeof message === "string" && BENIGN_RESIZE_OBSERVER_MESSAGES.has(message);
}

export function installBenignResizeObserverErrorGuard() {
  if (typeof window === "undefined") return () => undefined;

  const suppressBenignResizeObserverError = (event: ErrorEvent) => {
    if (!isBenignResizeObserverLoopError(event.message)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  window.addEventListener("error", suppressBenignResizeObserverError, true);

  return () => {
    window.removeEventListener("error", suppressBenignResizeObserverError, true);
  };
}
