#!/usr/bin/env bash
# Reproducible Emscripten build of OpenEXR → WASM for cairn-plot.
#
# Produces a single .wasm that decodes LITERALLY every OpenEXR the upstream
# OpenEXR C++ library reads — all compressions incl. HTJ2K (OpenJPH), scanline &
# tiled, deep, multi-part, luminance-chroma — via the C-ABI binding in
# src/binding.cpp. Single-threaded (no pthreads: pages run without COOP/COEP),
# -msimd128, wasm exceptions (OpenEXR requires exceptions).
#
# PINNED VERSIONS (all sources vendored under vendor/, checked out at these tags):
#   OpenEXR   v3.4.9   (b5fa98ac6b5fc660c0295123c1d02bbf687dbec3)
#   Imath     v3.2.2   (1e480d11cb98b032a2dece9b9a8730512effc7f6)
#   libdeflate v1.25   (OpenEXR-vendored external/deflate, OPENEXR_FORCE_INTERNAL_DEFLATE)
#   OpenJPH   0.26.3   (OpenEXR-vendored external/OpenJPH, OPENEXR_FORCE_INTERNAL_OPENJPH)
# Toolchain (pin to reproduce): Emscripten 6.0.3-git, CMake 4.4.0.
#
# Usage:  wasm/openexr/build.sh [Oz|O3]     (default Oz)
#         Two artifacts are produced under build/<opt>/: cairn_openexr.wasm.
set -euo pipefail

OPT="${1:-Oz}"
case "$OPT" in Oz|O3) ;; *) echo "opt must be Oz or O3" >&2; exit 1 ;; esac

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENDOR="$HERE/vendor"
IMATH_SRC="$VENDOR/imath"
OPENEXR_SRC="$VENDOR/openexr"

# Pinned upstream commits (tag → SHA). deflate v1.25 + OpenJPH 0.26.3 are
# vendored inside the OpenEXR tree (external/) and built via FORCE_INTERNAL.
IMATH_TAG="v3.2.2";   IMATH_SHA="1e480d11cb98b032a2dece9b9a8730512effc7f6"
OPENEXR_TAG="v3.4.9"; OPENEXR_SHA="b5fa98ac6b5fc660c0295123c1d02bbf687dbec3"

echo "=== [0/3] fetch pinned sources (idempotent) ==="
fetch() {  # <dir> <repo> <tag> <sha>
  local dir="$1" repo="$2" tag="$3" sha="$4"
  if [ -d "$dir/.git" ] && [ "$(git -C "$dir" rev-parse HEAD)" = "$sha" ]; then
    echo "  $tag already at $sha"; return
  fi
  rm -rf "$dir"
  git clone --depth 1 --branch "$tag" "$repo" "$dir"
  local got; got="$(git -C "$dir" rev-parse HEAD)"
  [ "$got" = "$sha" ] || { echo "SHA mismatch for $tag: got $got want $sha" >&2; exit 1; }
}
mkdir -p "$VENDOR"
fetch "$IMATH_SRC"   https://github.com/AcademySoftwareFoundation/Imath.git   "$IMATH_TAG"   "$IMATH_SHA"
fetch "$OPENEXR_SRC" https://github.com/AcademySoftwareFoundation/openexr.git "$OPENEXR_TAG" "$OPENEXR_SHA"

# PATCH (idempotent): Emscripten's CMake toolchain reports CMAKE_SYSTEM_PROCESSOR
# as "x86", so OpenEXR's "Enable SSE2 on 32-bit x86" block fires and injects
# `-mfpmath=sse` globally — a flag clang rejects on wasm ("unknown FP unit 'sse'")
# — which breaks Iex and the vendored OpenJPH. Exclude Emscripten from that block;
# we drive wasm SIMD via -msimd128 in CFLAGS instead.
SETUP="$OPENEXR_SRC/cmake/OpenEXRSetup.cmake"
if ! grep -q 'x86)\$" AND NOT MSVC AND NOT EMSCRIPTEN' "$SETUP"; then
  perl -0pi -e 's/(CMAKE_SYSTEM_PROCESSOR MATCHES "\^\(i\[3-6\]86\|x86\)\$" AND NOT MSVC)\)/$1 AND NOT EMSCRIPTEN)/' "$SETUP"
  grep -q 'AND NOT EMSCRIPTEN' "$SETUP" || { echo "patch failed" >&2; exit 1; }
  echo "  patched OpenEXRSetup.cmake (skip x86 SSE flags under Emscripten)"
fi
BUILD="$HERE/build/$OPT"
PREFIX="$HERE/build/prefix-$OPT"
rm -rf "$BUILD" "$PREFIX"
mkdir -p "$BUILD" "$PREFIX"

# Common flags: SIMD + wasm exceptions, size/speed per $OPT. Every translation
# unit (Imath, OpenEXR, OpenJPH, deflate, the binding) MUST share the exception
# model, so these go on every CMake build and the final link.
OPTFLAG="-$OPT"
EXFLAGS="-msimd128 -fwasm-exceptions"
CFLAGS_COMMON="$OPTFLAG $EXFLAGS"

echo "=== [1/3] Imath (static) ==="
emcmake cmake -S "$IMATH_SRC" -B "$BUILD/imath" -G "Unix Makefiles" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX="$PREFIX" \
  -DBUILD_SHARED_LIBS=OFF \
  -DBUILD_TESTING=OFF \
  -DIMATH_INSTALL_PKG_CONFIG=ON \
  -DPYTHON=OFF \
  -DCMAKE_C_FLAGS="$CFLAGS_COMMON" \
  -DCMAKE_CXX_FLAGS="$CFLAGS_COMMON"
cmake --build "$BUILD/imath" --target install -j"$(sysctl -n hw.ncpu)"

echo "=== [2/3] OpenEXR (static, single-threaded, internal deflate + OpenJPH) ==="
emcmake cmake -S "$OPENEXR_SRC" -B "$BUILD/openexr" -G "Unix Makefiles" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX="$PREFIX" \
  -DCMAKE_PREFIX_PATH="$PREFIX" \
  -DBUILD_SHARED_LIBS=OFF \
  -DBUILD_TESTING=OFF \
  -DOPENEXR_BUILD_EXAMPLES=OFF \
  -DOPENEXR_BUILD_TOOLS=OFF \
  -DOPENEXR_INSTALL_TOOLS=OFF \
  -DOPENEXR_ENABLE_THREADING=OFF \
  -DOPENEXR_FORCE_INTERNAL_DEFLATE=ON \
  -DOPENEXR_FORCE_INTERNAL_OPENJPH=ON \
  -DOPENEXR_FORCE_INTERNAL_IMATH=OFF \
  -DCMAKE_C_FLAGS="$CFLAGS_COMMON" \
  -DCMAKE_CXX_FLAGS="$CFLAGS_COMMON"
cmake --build "$BUILD/openexr" --target install -j"$(sysctl -n hw.ncpu)"

echo "=== [3/3] link binding → cairn_openexr.mjs + .wasm ==="
# Static libs installed under $PREFIX/lib (names carry the version: OpenEXR-3_4,
# Imath-3_2, …). The vendored OpenJPH (FORCE_INTERNAL) is NOT installed to the
# prefix, so grab it from the build tree. Order is dependency-first (consumers
# before providers): OpenEXRCore's HTJ2K (internal_ht) needs OpenJPH. Emscripten's
# minimal ES6 glue (FILESYSTEM=0) supplies the wasm's runtime imports (memory
# growth, abort); the .wasm stays a SEPARATE file so the inline packager can
# deflate it and the glue instantiates from `wasmBinary` (no fetch — CSP-safe).
OJPH_LIB="$BUILD/openexr/external/OpenJPH/src/core/libopenjph.a"
[ -f "$OJPH_LIB" ] || { echo "missing $OJPH_LIB" >&2; exit 1; }
LIBS=(
  "$PREFIX"/lib/libOpenEXRUtil-*.a
  "$PREFIX"/lib/libOpenEXR-*.a
  "$PREFIX"/lib/libOpenEXRCore-*.a
  "$OJPH_LIB"
  "$PREFIX"/lib/libIlmThread-*.a
  "$PREFIX"/lib/libIex-*.a
  "$PREFIX"/lib/libImath-*.a
)
em++ $CFLAGS_COMMON -std=c++17 \
  -I"$PREFIX/include" \
  -I"$PREFIX/include/Imath" \
  -I"$PREFIX/include/OpenEXR" \
  "$HERE/src/binding.cpp" \
  "${LIBS[@]}" \
  -o "$BUILD/cairn_openexr.mjs" \
  -sMODULARIZE=1 \
  -sEXPORT_ES6=1 \
  -sEXPORT_NAME=CairnOpenExr \
  -sEXPORTED_FUNCTIONS='["_cairn_exr_decode","_cairn_exr_free","_cairn_exr_open_deep","_cairn_exr_flatten_deep","_cairn_exr_free_open_deep","_cairn_exr_free_deep","_malloc","_free"]' \
  -sEXPORTED_RUNTIME_METHODS='["HEAPU8","HEAP32","HEAPU16","HEAPF32","UTF8ToString"]' \
  -sALLOW_MEMORY_GROWTH=1 \
  -sINITIAL_MEMORY=33554432 \
  -sSTACK_SIZE=1048576 \
  -sFILESYSTEM=0 \
  -sENVIRONMENT=web,worker \
  -sSINGLE_FILE=0

echo
echo "=== BUILT ==="
ls -l "$BUILD/cairn_openexr.mjs" "$BUILD/cairn_openexr.wasm"
