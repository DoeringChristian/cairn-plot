#!/usr/bin/env bash
# Build a NATIVE (host) OpenEXR + the fixture generator (gen.cpp), then emit the
# coverage/benchmark fixtures. Reuses the pinned sources under ../vendor (fetched
# by ../build.sh). This is a developer tool: the generated small fixtures are
# committed; the tool + native build tree are not.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENDOR="$HERE/../vendor"
BUILD="$HERE/native-build"
PREFIX="$BUILD/prefix"
OUT="${1:-$HERE/out}"
mkdir -p "$BUILD" "$PREFIX" "$OUT"

echo "=== native Imath ==="
cmake -S "$VENDOR/imath" -B "$BUILD/imath" -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX="$PREFIX" -DBUILD_SHARED_LIBS=OFF -DBUILD_TESTING=OFF -DPYTHON=OFF >/dev/null
cmake --build "$BUILD/imath" --target install -j"$(sysctl -n hw.ncpu)" >/dev/null

echo "=== native OpenEXR (internal deflate + OpenJPH for HTJ2K) ==="
cmake -S "$VENDOR/openexr" -B "$BUILD/openexr" -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX="$PREFIX" -DCMAKE_PREFIX_PATH="$PREFIX" \
  -DBUILD_SHARED_LIBS=OFF -DBUILD_TESTING=OFF \
  -DOPENEXR_BUILD_EXAMPLES=OFF -DOPENEXR_BUILD_TOOLS=OFF -DOPENEXR_INSTALL_TOOLS=OFF \
  -DOPENEXR_FORCE_INTERNAL_DEFLATE=ON -DOPENEXR_FORCE_INTERNAL_OPENJPH=ON >/dev/null
cmake --build "$BUILD/openexr" --target install -j"$(sysctl -n hw.ncpu)" >/dev/null

echo "=== compile + run generator ==="
OJPH_LIB="$BUILD/openexr/external/OpenJPH/src/core/libopenjph.a"
c++ -std=c++17 -O2 \
  -I"$PREFIX/include" -I"$PREFIX/include/Imath" -I"$PREFIX/include/OpenEXR" \
  "$HERE/gen.cpp" \
  "$PREFIX"/lib/libOpenEXRUtil-*.a "$PREFIX"/lib/libOpenEXR-*.a "$PREFIX"/lib/libOpenEXRCore-*.a \
  "$OJPH_LIB" "$PREFIX"/lib/libIlmThread-*.a "$PREFIX"/lib/libIex-*.a "$PREFIX"/lib/libImath-*.a \
  -lz -o "$BUILD/gen"
"$BUILD/gen" "$OUT"
echo "=== fixtures written to $OUT ==="
ls -l "$OUT"
