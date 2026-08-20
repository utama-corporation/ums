export interface PollingLoop {
  start(): void;
  /** Stops scheduling new cycles and waits (up to timeoutMs) for an in-flight cycle to finish. */
  stop(timeoutMs?: number): Promise<void>;
}

export function createPollingLoop(name: string, intervalMs: number, cycleFn: () => Promise<unknown>): PollingLoop {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let running = false;
  let stopped = false;

  async function tick() {
    if (running || stopped) return;
    running = true;
    try {
      await cycleFn();
    } catch (err) {
      console.error(`[${name}_LOOP_ERROR]`, err);
    } finally {
      running = false;
    }
  }

  return {
    start() {
      console.log(`[${name}] Starting loop (interval: ${intervalMs}ms)...`);
      intervalId = setInterval(tick, intervalMs);
    },
    async stop(timeoutMs = 8000) {
      stopped = true;
      if (intervalId) clearInterval(intervalId);

      const deadline = Date.now() + timeoutMs;
      while (running && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      console.log(`[${name}] Stopped${running ? " (timed out waiting for in-flight cycle)" : ""}.`);
    },
  };
}
