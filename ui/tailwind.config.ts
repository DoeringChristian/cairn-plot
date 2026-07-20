import type { Config } from "tailwindcss";
// The semantic plot palette (bg/fg/border/accent + `mono` font) lives in the
// cairn-plot library preset so the library is self-contained; the standalone
// build consumes it directly (no app-only theme layered on top — that's the
// cairn app's concern).
import cairnPlotPreset from "./src/lib/cairn-plot/tailwind-preset";

export default {
  presets: [cairnPlotPreset],
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  plugins: [],
} satisfies Config;
