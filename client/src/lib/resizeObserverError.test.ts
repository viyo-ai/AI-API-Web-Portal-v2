import { afterEach, describe, expect, it, vi } from "vitest";
import { installBenignResizeObserverErrorGuard, isBenignResizeObserverLoopError } from "./resizeObserverError";

describe("ResizeObserver loop error guard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("recognizes only known benign ResizeObserver loop messages", () => {
    expect(isBenignResizeObserverLoopError("ResizeObserver loop completed with undelivered notifications.")).toBe(true);
    expect(isBenignResizeObserverLoopError("ResizeObserver loop limit exceeded")).toBe(true);
    expect(isBenignResizeObserverLoopError("Failed query: select * from tasks")).toBe(false);
    expect(isBenignResizeObserverLoopError(undefined)).toBe(false);
  });

  it("installs a removable capture listener for terminal-scoped ResizeObserver noise", () => {
    const listeners: Array<(event: ErrorEvent) => void> = [];
    const fakeWindow = {
      addEventListener: vi.fn((type: string, listener: (event: ErrorEvent) => void, options?: boolean) => {
        expect(type).toBe("error");
        expect(options).toBe(true);
        listeners.push(listener);
      }),
      removeEventListener: vi.fn((type: string, listener: (event: ErrorEvent) => void, options?: boolean) => {
        expect(type).toBe("error");
        expect(options).toBe(true);
        expect(listeners).toContain(listener);
      }),
    };
    vi.stubGlobal("window", fakeWindow);

    const cleanup = installBenignResizeObserverErrorGuard();
    expect(fakeWindow.addEventListener).toHaveBeenCalledTimes(1);

    const benignEvent = {
      message: "ResizeObserver loop completed with undelivered notifications.",
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn(),
    } as unknown as ErrorEvent;
    listeners[0](benignEvent);
    expect(benignEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(benignEvent.stopImmediatePropagation).toHaveBeenCalledTimes(1);

    const realErrorEvent = {
      message: "Failed query: select * from tasks",
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn(),
    } as unknown as ErrorEvent;
    listeners[0](realErrorEvent);
    expect(realErrorEvent.preventDefault).not.toHaveBeenCalled();
    expect(realErrorEvent.stopImmediatePropagation).not.toHaveBeenCalled();

    cleanup();
    expect(fakeWindow.removeEventListener).toHaveBeenCalledWith("error", listeners[0], true);
  });
});
