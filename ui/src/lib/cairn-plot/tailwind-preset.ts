import type { Config } from "tailwindcss";

/**
 * Self-contained Tailwind preset for the cairn-plot library.
 *
 * The plot renderers use a fixed set of *semantic* utility classes
 * (`bg-bg`, `bg-bg-elevated`, `text-fg`, `text-fg-muted`, `border-border`,
 * `border-accent`, `font-mono`, …). Historically those class names resolved
 * only through the APP's `tailwind.config.ts`, coupling the library to app
 * config. This preset owns that palette + the `mono` font stack so BOTH the
 * app config and any standalone (post-extraction) plot build can produce the
 * exact same utilities by simply listing this preset — no duplicated theme.
 *
 * Only the tokens the library itself renders against live here. App-only
 * theme (e.g. the `status.*` run colors) stays in the app config's own
 * `theme.extend`, which Tailwind deep-merges on top of this preset.
 *
 * The literal hex values are byte-identical to the pre-preset app config so
 * the compiled utilities are unchanged.
 */
export default {
  content: [],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        // Semantic palette routed through the token contract (tokens.css /
        // the report theme) as RGB TRIPLET custom properties, so utilities —
        // including opacity-modified ones like `bg-bg-elevated/90` — follow
        // light/dark at runtime instead of baking the light hex. The `-rgb`
        // triplets are defined alongside the hex tokens in both themes.
        bg: {
          DEFAULT: "rgb(var(--color-bg-rgb) / <alpha-value>)",
          elevated: "rgb(var(--color-bg-elevated-rgb) / <alpha-value>)",
          hover: "rgb(var(--color-bg-hover-rgb) / <alpha-value>)",
        },
        fg: {
          DEFAULT: "rgb(var(--color-fg-rgb) / <alpha-value>)",
          muted: "rgb(var(--color-fg-muted-rgb) / <alpha-value>)",
          subtle: "rgb(var(--color-fg-subtle-rgb) / <alpha-value>)",
        },
        border: {
          DEFAULT: "rgb(var(--color-border-rgb) / <alpha-value>)",
          subtle: "rgb(var(--color-border-subtle-rgb) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--color-accent-rgb) / <alpha-value>)",
          hover: "rgb(var(--color-accent-hover-rgb) / <alpha-value>)",
        },
      },
    },
  },
} satisfies Config;
