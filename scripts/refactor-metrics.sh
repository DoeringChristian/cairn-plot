#!/usr/bin/env bash
# Structural-refactor accounting: if/ternary/LOC per touched file.
# Usage: bash scripts/refactor-metrics.sh
set -euo pipefail
cd "$(dirname "$0")/.."
FILES=(
  ui/src/lib/cairn-plot/renderers/GpuImagePane.tsx
  ui/src/lib/cairn-plot/renderers/CpuImagePane.tsx
  ui/src/lib/cairn-plot/renderers/render-snapshot.ts
  ui/src/lib/cairn-plot/renderers/display-encoding.ts
  ui/src/lib/cairn-plot/engine/pool.ts
  ui/src/lib/cairn-plot/engine/image-engine.ts
  ui/src/lib/cairn-plot/engine/diff-engine.ts
  ui/src/lib/cairn-plot/engine/test-hooks.ts
  ui/src/lib/cairn-plot/viewport/image-settings-sync.ts
  ui/src/plot-node.tsx
  ui/src/lib/cairn-plot/resolve-cache.ts
  ui/src/lib/cairn-plot/stack/stack-context.ts
)
tot_if=0; tot_tern=0; tot_loc=0
printf "%-56s %6s %6s %6s\n" "file" "if" "?:" "loc"
for f in "${FILES[@]}"; do
  [ -f "$f" ] || { printf "%-56s %6s %6s %6s\n" "$(basename "$f")" "-" "-" "-"; continue; }
  ifc=$( { grep -oE '\bif\b' "$f" || true; } | wc -l | tr -d ' ')
  ter=$( { grep -oE '[^?.]\? ' "$f" || true; } | wc -l | tr -d ' ')
  loc=$(wc -l < "$f" | tr -d ' ')
  tot_if=$((tot_if+ifc)); tot_tern=$((tot_tern+ter)); tot_loc=$((tot_loc+loc))
  printf "%-56s %6s %6s %6s\n" "$(basename "$f")" "$ifc" "$ter" "$loc"
done
printf "%-56s %6s %6s %6s\n" "TOTAL" "$tot_if" "$tot_tern" "$tot_loc"
