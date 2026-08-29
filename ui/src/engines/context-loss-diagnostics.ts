/** Backend-neutral graphics-context loss event used by the opt-in browser log. */
export interface ContextLossEvent {
  readonly kind: string;
  readonly t: number;
  readonly detail?: unknown;
}

interface DiagnosticsWindow extends Window {
  __cairnContextLossEvents?: ContextLossEvent[];
}

/** Record only when the diagnostic harness has installed its bounded sink. */
export function recordContextLossEvent(kind: string, detail?: unknown): void {
  if (typeof window === "undefined") return;
  const events = (window as DiagnosticsWindow).__cairnContextLossEvents;
  if (!events || events.length >= 500) return;
  const t = typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
  const event: ContextLossEvent = { kind, t, detail };
  events.push(event);
  console.warn(
    `cairn-plot graphics context event [${kind}] @ ${t.toFixed(0)}ms — captured on window.__cairnContextLossEvents.`,
    event,
  );
}
