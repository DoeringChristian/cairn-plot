// ---------------------------------------------------------------------------
// PaneUnavailable — the ONE placeholder a pane renders when a capability it
// needs isn't available (WebGL2 for the volume raymarcher, WebGPU for a float
// compare, …). These are CAPABILITY FACTS, not errors: the browser/GPU simply
// can't do the thing, so the styling is neutral-muted (never red/error), with a
// short bold title + a one-line explanation.
//
// Unifies three divergent stylings that used to describe the SAME concept:
//   - VolumeViewer's neutral `bg-bg-hover` placeholder,
//   - compositor's RED `CompareFloatUnsupportedError` card, and
//   - CpuImagePane's console.warn-only WebGL2 branch (untouched here — owned by
//     another workstream; see the CHIPS report note).
// ---------------------------------------------------------------------------

export default function PaneUnavailable({
  title,
  body,
  className,
}: {
  /** Short bold headline — the capability that's missing. */
  title: string;
  /** One-line plain explanation of why + what's needed. */
  body: string;
  /** Outer wrapper class (defaults to a full-size relative box). */
  className?: string;
}) {
  return (
    <div className={className ?? "relative h-full w-full"}>
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 rounded bg-bg-hover p-4 text-center">
        <div className="text-sm font-semibold text-fg">{title}</div>
        <div className="text-xs text-fg-muted">{body}</div>
      </div>
    </div>
  );
}
