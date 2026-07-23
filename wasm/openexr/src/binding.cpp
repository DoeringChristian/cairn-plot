// cairn-plot OpenEXR → WASM decode binding (C ABI, hand-rolled JS glue).
//
// One entry point, `cairn_exr_decode(bytes,len)`, that reads ANY OpenEXR the
// upstream OpenEXR C++ library can read — every compression (NONE/RLE/ZIP/ZIPS/
// PIZ/PXR24/B44/B44A/DWAA/DWAB and HTJ2K via OpenJPH), scanline & tiled, deep,
// multi-part, and luminance-chroma — and returns cairn-plot's canonical
// interleaved, top-to-bottom, channel-compacted image (see decoders.ts):
//
//   R,G,B(,A) present  → 3 or 4 channels in that order.
//   Y+RY+BY present    → RgbaInputFile does native YC→RGBA reconstruction
//                        → 3 (no A) or 4 (A) channels.
//   exactly 1 channel  → 1 channel.
//   deep (scanline/tile)→ per-pixel sort by Z + front-to-back OVER composite
//                        → premultiplied RGBA (or RGB), flattened for display.
//   anything else      → typed "unsupported-channel-layout" error (TS fallback).
//
// Precision preserves bits: if every selected channel is HALF the payload is
// the raw IEEE-754 binary16 BIT PATTERNS (u16, NEVER widened to f32); otherwise
// f32. Luma-chroma and deep composites stay HALF (Rgba is half; deep composites
// in f32 then round to half) so the f16 GPU path survives end-to-end.
//
// A C ABI (not embind) keeps the artifact small: the JS glue in
// wasm-exr-inline.ts reads the result struct straight out of the heap.

#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <algorithm>
#include <limits>
#include <vector>
#include <string>
#include <exception>

#include <ImfMultiPartInputFile.h>
#include <ImfInputPart.h>
#include <ImfRgbaFile.h>
#include <ImfDeepScanLineInputPart.h>
#include <ImfDeepTiledInputPart.h>
#include <ImfChannelList.h>
#include <ImfFrameBuffer.h>
#include <ImfDeepFrameBuffer.h>
#include <ImfPartType.h>
#include <ImfHeader.h>
#include <ImfIO.h>
#include <ImfArray.h>
#include <ImathBox.h>
#include <half.h>

using namespace Imf;
using namespace Imath;

// ---------------------------------------------------------------------------
// Result struct — a flat block of 4-byte fields the JS glue reads from HEAP32.
// Field order is a CONTRACT with wasm-exr-inline.ts; do not reorder.
// ---------------------------------------------------------------------------
extern "C" {
struct DecodeResult {
  int32_t status;     // 0 = ok, 1 = error
  int32_t width;
  int32_t height;
  int32_t channels;   // 1 | 3 | 4
  int32_t precision;  // 0 = f16-bits (u16 payload), 1 = f32
  int32_t data_ptr;   // malloc'd payload (u16 or f32), element count = w*h*ch
  int32_t data_len;   // element count
  int32_t err_code;   // malloc'd null-terminated C string (or 0)
  int32_t err_msg;    // malloc'd null-terminated C string (or 0)
};

// ---------------------------------------------------------------------------
// DEEP live-flatten ABI (depth-slider). `cairn_exr_open_deep` parses + reads a
// deep EXR ONCE, RETAINS its per-pixel samples in wasm memory behind an opaque
// handle, and reports the Z range; `cairn_exr_flatten_deep(handle, zClip)` then
// composites (front-to-back OVER) ONLY the samples with Z ≤ zClip into a flat
// f16 RGBA image, live, with NO re-decode; `cairn_exr_free_deep` releases the
// handle. Field order is a CONTRACT with wasm-exr-inline.ts; do not reorder.
//
// zMin/zMax are FLOATs read out of HEAPF32 at their word offsets (5, 6);
// everything else is int32 in HEAP32. `total_samples` is reported so the host
// (and the retained-vs-redecode bench) can size the retained payload.
struct DeepOpenResult {
  int32_t status;         // 0 = ok, 1 = error
  int32_t handle;         // opaque DeepHandle* (0 on error)
  int32_t width;
  int32_t height;
  int32_t channels;       // 3 | 4
  float   z_min;          // HEAPF32 word 5
  float   z_max;          // HEAPF32 word 6
  int32_t total_samples;  // Σ per-pixel sample counts (retained-memory sizing)
  int32_t err_code;       // malloc'd null-terminated C string (or 0)
  int32_t err_msg;        // malloc'd null-terminated C string (or 0)
};

// GPU-composite CSR export: the retained deep samples, PER-PIXEL Z-SORTED and
// laid out for direct upload to WebGPU storage buffers so the depth slider can
// composite on the GPU (uniform write + one pass) with no wasm round-trip. The
// fragment shader walks `offsets[i]..offsets[i+1)` and OVER-accumulates while
// `z ≤ zClip` (samples ascending in Z ⇒ early break). Field order is a CONTRACT
// with wasm-exr-inline.ts.
struct DeepGpuCsr {
  int32_t status;       // 0 = ok, 1 = error
  int32_t offsets_ptr;  // uint32_t*  — length width*height+1 (prefix sums)
  int32_t colors_ptr;   // float*     — length 4*total (premultiplied RGBA/sample)
  int32_t z_ptr;        // float*     — length total (per-sample Z, sorted asc.)
  int32_t total;        // Σ samples
  int32_t width;
  int32_t height;
  int32_t err_code;     // malloc'd C string (or 0)
  int32_t err_msg;      // malloc'd C string (or 0)
};

// Z range of the samples inside an image-pixel RECT (region-select → depth
// window). z_min/z_max are FLOATs (HEAPF32 words 1,2); `count` is the number of
// samples found (0 ⇒ empty region, the host then no-ops). Field order is a
// CONTRACT with wasm-exr-inline.ts.
struct DeepZRange {
  int32_t status;    // 0 = ok, 1 = error
  float   z_min;     // HEAPF32 word 1
  float   z_max;     // HEAPF32 word 2
  int32_t count;     // samples in the rect (0 = empty)
  int32_t err_code;  // malloc'd C string (or 0)
  int32_t err_msg;   // malloc'd C string (or 0)
};
}

static const int PREC_F16BITS = 0;
static const int PREC_F32 = 1;

// A read-only, seekable OpenEXR stream over an in-memory byte buffer.
class MemIStream : public IStream {
 public:
  MemIStream(const char* buf, uint64_t size)
      : IStream("<memory>"), buf_(buf), size_(size), pos_(0) {}

  bool isMemoryMapped() const override { return true; }

  char* readMemoryMapped(int n) override {
    if (pos_ + (uint64_t)n > size_)
      throw std::runtime_error("cairn-exr: read past end of memory stream");
    char* p = const_cast<char*>(buf_ + pos_);
    pos_ += n;
    return p;
  }

  bool read(char c[], int n) override {
    if (pos_ + (uint64_t)n > size_)
      throw std::runtime_error("cairn-exr: read past end of memory stream");
    std::memcpy(c, buf_ + pos_, n);
    pos_ += n;
    return pos_ < size_;
  }

  uint64_t tellg() override { return pos_; }
  void seekg(uint64_t p) override { pos_ = p; }

 private:
  const char* buf_;
  uint64_t size_;
  uint64_t pos_;
};

namespace {

char* dupCStr(const std::string& s) {
  char* p = static_cast<char*>(std::malloc(s.size() + 1));
  std::memcpy(p, s.c_str(), s.size() + 1);
  return p;
}

DecodeResult* makeError(const std::string& code, const std::string& msg) {
  DecodeResult* r = static_cast<DecodeResult*>(std::calloc(1, sizeof(DecodeResult)));
  r->status = 1;
  r->err_code = (int32_t)reinterpret_cast<intptr_t>(dupCStr(code));
  r->err_msg = (int32_t)reinterpret_cast<intptr_t>(dupCStr(msg));
  return r;
}

// Which selected channels (by name) to emit, in output order.
struct ChannelPlan {
  std::vector<std::string> names;  // output order
  int out;                         // 1 | 3 | 4
  bool lumaChroma;                 // Y/RY/BY → RgbaInputFile path
};

bool hasChan(const ChannelList& cl, const char* n) {
  return cl.findChannel(n) != nullptr;
}

// Mirror the TS/Rust planChannels: luma-chroma → RGBA; R,G,B(,A) → 3/4;
// exactly one channel → 1; else unsupported.
bool planChannels(const ChannelList& cl, ChannelPlan& plan, std::string& err) {
  if (hasChan(cl, "Y") && hasChan(cl, "RY") && hasChan(cl, "BY")) {
    plan.lumaChroma = true;
    plan.out = hasChan(cl, "A") ? 4 : 3;
    return true;
  }
  plan.lumaChroma = false;
  if (hasChan(cl, "R") && hasChan(cl, "G") && hasChan(cl, "B")) {
    plan.names = {"R", "G", "B"};
    if (hasChan(cl, "A")) plan.names.push_back("A");
    plan.out = (int)plan.names.size();
    return true;
  }
  int count = 0;
  std::string only;
  for (auto it = cl.begin(); it != cl.end(); ++it) {
    only = it.name();
    ++count;
  }
  if (count == 1) {
    plan.names = {only};
    plan.out = 1;
    return true;
  }
  std::string list;
  for (auto it = cl.begin(); it != cl.end(); ++it) {
    if (!list.empty()) list += ",";
    list += it.name();
  }
  err = "unsupported channel layout [" + list + "]";
  return false;
}

bool allHalf(const ChannelList& cl, const ChannelPlan& plan) {
  for (const auto& n : plan.names) {
    const Channel* c = cl.findChannel(n.c_str());
    if (!c || c->type != HALF) return false;
  }
  return true;
}

// ----- Flat (scanline OR tiled; InputPart reads both) → interleaved --------
DecodeResult* decodeFlat(MultiPartInputFile& mfile, const Header& h,
                         const ChannelPlan& plan) {
  const Box2i& dw = h.dataWindow();
  int width = dw.max.x - dw.min.x + 1;
  int height = dw.max.y - dw.min.y + 1;
  size_t pixels = (size_t)width * height;
  int ch = plan.out;
  bool half = allHalf(h.channels(), plan);

  InputPart part(mfile, 0);
  FrameBuffer fb;
  DecodeResult* r =
      static_cast<DecodeResult*>(std::calloc(1, sizeof(DecodeResult)));

  if (half) {
    size_t elem = sizeof(uint16_t);
    uint16_t* out = static_cast<uint16_t*>(std::malloc(pixels * ch * elem));
    size_t xs = (size_t)ch * elem;
    size_t ys = (size_t)width * ch * elem;
    char* base = reinterpret_cast<char*>(out) -
                 (size_t)dw.min.x * xs - (size_t)dw.min.y * ys;
    for (int c = 0; c < ch; ++c)
      fb.insert(plan.names[c],
                Slice(HALF, base + (size_t)c * elem, xs, ys, 1, 1, 0.0));
    part.setFrameBuffer(fb);
    part.readPixels(dw.min.y, dw.max.y);
    r->precision = PREC_F16BITS;
    r->data_ptr = (int32_t)reinterpret_cast<intptr_t>(out);
  } else {
    size_t elem = sizeof(float);
    float* out = static_cast<float*>(std::malloc(pixels * ch * elem));
    size_t xs = (size_t)ch * elem;
    size_t ys = (size_t)width * ch * elem;
    char* base = reinterpret_cast<char*>(out) -
                 (size_t)dw.min.x * xs - (size_t)dw.min.y * ys;
    for (int c = 0; c < ch; ++c)
      fb.insert(plan.names[c],
                Slice(FLOAT, base + (size_t)c * elem, xs, ys, 1, 1, 0.0));
    part.setFrameBuffer(fb);
    part.readPixels(dw.min.y, dw.max.y);
    r->precision = PREC_F32;
    r->data_ptr = (int32_t)reinterpret_cast<intptr_t>(out);
  }
  r->status = 0;
  r->width = width;
  r->height = height;
  r->channels = ch;
  r->data_len = (int)(pixels * ch);
  return r;
}

// ----- Luminance-chroma → RgbaInputFile (native YC reconstruction) ---------
DecodeResult* decodeLumaChroma(MemIStream& stream, const ChannelPlan& plan) {
  stream.seekg(0);
  RgbaInputFile file(stream);
  const Box2i& dw = file.dataWindow();
  int width = dw.max.x - dw.min.x + 1;
  int height = dw.max.y - dw.min.y + 1;
  size_t pixels = (size_t)width * height;

  Array2D<Rgba> px(height, width);
  file.setFrameBuffer(&px[0][0] - dw.min.x - (size_t)dw.min.y * width, 1, width);
  file.readPixels(dw.min.y, dw.max.y);

  int ch = plan.out;  // 3 or 4, half output (Rgba is half)
  uint16_t* out = static_cast<uint16_t*>(
      std::malloc(pixels * ch * sizeof(uint16_t)));
  for (size_t i = 0; i < pixels; ++i) {
    const Rgba& p = px[i / width][i % width];
    out[i * ch + 0] = p.r.bits();
    out[i * ch + 1] = p.g.bits();
    out[i * ch + 2] = p.b.bits();
    if (ch == 4) out[i * ch + 3] = p.a.bits();
  }
  DecodeResult* r =
      static_cast<DecodeResult*>(std::calloc(1, sizeof(DecodeResult)));
  r->status = 0;
  r->width = width;
  r->height = height;
  r->channels = ch;
  r->precision = PREC_F16BITS;
  r->data_ptr = (int32_t)reinterpret_cast<intptr_t>(out);
  r->data_len = (int)(pixels * ch);
  return r;
}

// ----- Deep (scanline or tiled) → retained samples → live Z-clipped flatten --
//
// A DeepHandle retains one deep image's per-pixel samples in wasm memory in a
// compact CSR layout (a single flat array per channel + a per-pixel offset
// prefix-sum), so `flattenDeep(zClip)` re-composites live with NO re-decode —
// fast enough for a REAL-TIME drag. Samples are premultiplied (associated
// alpha) floats, exactly as read.
//
//   offsets[i]..offsets[i+1)  are pixel i's sample indices into R/G/B/A/Z.
//   A empty ⇒ opaque (a=1);   Z empty ⇒ file order, no depth clip.
//
// RETENTION-FIRST with a GLOBAL LRU BYTE BUDGET (see the deep-LRU manager
// below): every handle ALSO keeps its compressed `fileBytes`, so an evicted
// handle (whose CSR was dropped to stay under budget) degrades gracefully to a
// re-decode inside flatten. `fileBytes` is always-present overhead; only the
// (large) CSR counts toward the budget.
struct DeepHandle {
  int width = 0, height = 0, channels = 3;  // channels: 3 | 4
  bool hasA = false, hasZ = false;
  float zMin = 0.0f, zMax = 0.0f;
  size_t sampleTotal = 0;                    // Σ per-pixel sample counts

  // `retained` = the CSR arrays below hold the samples (zero-decode flatten).
  // When false the CSR was evicted (or never kept) and flatten RE-DECODES from
  // `fileBytes`. `lastUse` is the LRU clock stamp (bumped on every flatten).
  bool retained = true;
  uint64_t lastUse = 0;
  size_t retainedCsrBytes = 0;               // CSR bytes counted toward the budget
  std::vector<uint32_t> offsets;            // size pixels+1 (prefix sum)
  std::vector<float> R, G, B, A, Z;         // A/Z empty when absent
  std::vector<uint8_t> fileBytes;           // ALWAYS kept: redecode-on-evict source

  size_t totalSamples() const { return sampleTotal; }
  // Bytes the CSR arrays occupy when retained.
  size_t csrBytes() const {
    size_t perSample = ((size_t)3 + (hasA ? 1 : 0) + (hasZ ? 1 : 0)) * sizeof(float);
    return sampleTotal * perSample + (sampleTotal ? ((size_t)width * height + 1) : 0) * sizeof(uint32_t);
  }
  void dropCsr() {
    offsets.clear(); offsets.shrink_to_fit();
    R.clear(); R.shrink_to_fit();
    G.clear(); G.shrink_to_fit();
    B.clear(); B.shrink_to_fit();
    A.clear(); A.shrink_to_fit();
    Z.clear(); Z.shrink_to_fit();
    retained = false;
  }
};

// ---- Global deep-retention LRU manager -------------------------------------
// Retention-first: a newly opened handle keeps its CSR; if the sum of retained
// CSR bytes exceeds the budget, the LEAST-recently-used retained handles are
// evicted (CSR dropped → redecode-on-flatten) until back under budget. Default
// 512 MB, overridable via cairn_exr_set_deep_budget (used by the eviction test).
// Single-threaded wasm ⇒ no locking; handle counts are tiny ⇒ O(n) LRU scan.
static const size_t DEEP_BUDGET_DEFAULT = (size_t)512 * 1024 * 1024;
static size_t g_deepBudget = DEEP_BUDGET_DEFAULT;
static size_t g_deepRetainedBytes = 0;
static uint64_t g_deepClock = 0;
static std::vector<DeepHandle*> g_deepRetained;  // handles currently holding CSR

static void deepEvictToBudget(DeepHandle* keep) {
  // Evict least-recently-used retained handles until under budget. `keep` (the
  // just-opened handle) is evicted LAST — only if it alone still exceeds budget.
  while (g_deepRetainedBytes > g_deepBudget && !g_deepRetained.empty()) {
    DeepHandle* victim = nullptr;
    size_t vidx = 0;
    for (size_t i = 0; i < g_deepRetained.size(); ++i) {
      DeepHandle* h = g_deepRetained[i];
      if (h == keep) continue;  // prefer any other handle first
      if (!victim || h->lastUse < victim->lastUse) { victim = h; vidx = i; }
    }
    if (!victim) {  // only `keep` remains — evict it too if still over budget
      victim = keep;
      for (size_t i = 0; i < g_deepRetained.size(); ++i)
        if (g_deepRetained[i] == keep) { vidx = i; break; }
    }
    g_deepRetainedBytes -= victim->retainedCsrBytes;
    victim->retainedCsrBytes = 0;
    victim->dropCsr();
    g_deepRetained.erase(g_deepRetained.begin() + vidx);
    if (victim == keep) break;
  }
}

static void deepRetainRegister(DeepHandle* hd) {
  hd->retained = true;
  hd->retainedCsrBytes = hd->csrBytes();
  hd->lastUse = ++g_deepClock;
  g_deepRetained.push_back(hd);
  g_deepRetainedBytes += hd->retainedCsrBytes;
  deepEvictToBudget(hd);
}

static void deepTouch(DeepHandle* hd) {
  if (hd->retained) hd->lastUse = ++g_deepClock;
}

static void deepUnregister(DeepHandle* hd) {
  if (!hd->retained) return;
  for (size_t i = 0; i < g_deepRetained.size(); ++i)
    if (g_deepRetained[i] == hd) { g_deepRetained.erase(g_deepRetained.begin() + i); break; }
  g_deepRetainedBytes -= hd->retainedCsrBytes;
  hd->retainedCsrBytes = 0;
}

// Read every sample of a deep part (scanline or tiled) into `hd` (CSR). Throws
// on an OpenEXR read error (caught at the ABI boundary). `hd` channels/flags
// must already be set from the header.
void readDeepInto(MultiPartInputFile& mfile, const Header& h, bool tiled,
                  DeepHandle& hd) {
  const Box2i& dw = h.dataWindow();
  int width = hd.width, height = hd.height;
  size_t pixels = (size_t)width * height;
  bool hasA = hd.hasA, hasZ = hd.hasZ;

  Array2D<unsigned int> counts(height, width);
  Array2D<float*> rp(height, width), gp(height, width), bp(height, width);
  Array2D<float*> ap(height, width), zp(height, width);

  DeepFrameBuffer fb;
  {
    char* cbase = reinterpret_cast<char*>(&counts[0][0]) -
                  ((size_t)dw.min.x + (size_t)dw.min.y * width) * sizeof(unsigned int);
    fb.insertSampleCountSlice(Slice(UINT, cbase, sizeof(unsigned int),
                                    sizeof(unsigned int) * width));
  }
  auto addSlice = [&](const char* name, Array2D<float*>& ptrs) {
    char* pbase = reinterpret_cast<char*>(&ptrs[0][0]) -
                  ((size_t)dw.min.x + (size_t)dw.min.y * width) * sizeof(float*);
    fb.insert(name, DeepSlice(FLOAT, pbase, sizeof(float*),
                              sizeof(float*) * width, sizeof(float)));
  };
  addSlice("R", rp);
  addSlice("G", gp);
  addSlice("B", bp);
  if (hasA) addSlice("A", ap);
  if (hasZ) addSlice("Z", zp);

  if (tiled) {
    DeepTiledInputPart part(mfile, 0);
    part.setFrameBuffer(fb);
    part.readPixelSampleCounts(0, part.numXTiles(0) - 1, 0,
                               part.numYTiles(0) - 1);
  } else {
    DeepScanLineInputPart part(mfile, 0);
    part.setFrameBuffer(fb);
    part.readPixelSampleCounts(dw.min.y, dw.max.y);
  }
  // Build the CSR offset table from the sample counts.
  hd.offsets.resize(pixels + 1);
  hd.offsets[0] = 0;
  for (size_t i = 0; i < pixels; ++i) {
    int y = (int)(i / width), x = (int)(i % width);
    hd.offsets[i + 1] = hd.offsets[i] + counts[y][x];
  }
  size_t total = hd.offsets[pixels];
  hd.sampleTotal = total;
  // Point each pixel's per-channel slice at its slot in the flat CSR arrays, so
  // OpenEXR reads samples straight into the retained buffers (no temp copies).
  hd.R.resize(total);
  hd.G.resize(total);
  hd.B.resize(total);
  if (hasA) hd.A.resize(total);
  if (hasZ) hd.Z.resize(total);
  for (size_t i = 0; i < pixels; ++i) {
    int y = (int)(i / width), x = (int)(i % width);
    uint32_t off = hd.offsets[i];
    unsigned int n = counts[y][x];
    rp[y][x] = n ? &hd.R[off] : nullptr;
    gp[y][x] = n ? &hd.G[off] : nullptr;
    bp[y][x] = n ? &hd.B[off] : nullptr;
    if (hasA) ap[y][x] = n ? &hd.A[off] : nullptr;
    if (hasZ) zp[y][x] = n ? &hd.Z[off] : nullptr;
  }
  if (tiled) {
    DeepTiledInputPart part(mfile, 0);
    part.setFrameBuffer(fb);
    part.readTiles(0, part.numXTiles(0) - 1, 0, part.numYTiles(0) - 1);
  } else {
    DeepScanLineInputPart part(mfile, 0);
    part.setFrameBuffer(fb);
    part.readPixels(dw.min.y, dw.max.y);
  }
  // Z range over all retained samples (for the slider bounds).
  if (hasZ && total > 0) {
    float lo = hd.Z[0], hi = hd.Z[0];
    for (size_t s = 0; s < total; ++s) {
      float z = hd.Z[s];
      if (z < lo) lo = z;
      if (z > hi) hi = z;
    }
    hd.zMin = lo;
    hd.zMax = hi;
  } else {
    hd.zMin = 0.0f;
    hd.zMax = 0.0f;
  }
}

// Composite the retained handle front-to-back with the OVER operator, INCLUDING
// only samples whose Z is inside the WINDOW [zNear, zFar] (when Z is present),
// into a flat premultiplied f16 RGBA(A) image. Samples are sorted ascending by
// Z first, so samples nearer than zNear are skipped and once a sample exceeds
// zFar every later one does too (early break). zNear = -inf ⇒ the legacy single
// far-cutoff behavior (bit-exact). Missing Z ⇒ all samples in file order.
DecodeResult* flattenHandle(const DeepHandle& hd, float zNear, float zFar) {
  int width = hd.width, height = hd.height, ch = hd.channels;
  size_t pixels = (size_t)width * height;
  bool hasA = hd.hasA, hasZ = hd.hasZ;

  uint16_t* out = static_cast<uint16_t*>(
      std::malloc(pixels * ch * sizeof(uint16_t)));
  std::vector<int> order;
  for (size_t i = 0; i < pixels; ++i) {
    uint32_t off = hd.offsets[i];
    unsigned int n = hd.offsets[i + 1] - off;
    order.resize(n);
    for (unsigned int s = 0; s < n; ++s) order[s] = (int)s;
    if (hasZ && n > 1) {
      const float* z = &hd.Z[off];
      std::sort(order.begin(), order.end(),
                [&](int a, int b) { return z[a] < z[b]; });
    }
    float aR = 0, aG = 0, aB = 0, aA = 0;
    for (unsigned int k = 0; k < n; ++k) {
      int s = order[k];
      if (hasZ) {
        float z = hd.Z[off + s];
        if (z < zNear) continue;      // nearer than the window front — skip
        if (z > zFar) break;          // sorted ⇒ rest are farther than the window
      }
      float sa = hasA ? hd.A[off + s] : 1.0f;
      float w = 1.0f - aA;  // front-to-back OVER, associated alpha
      aR += w * hd.R[off + s];
      aG += w * hd.G[off + s];
      aB += w * hd.B[off + s];
      aA += w * sa;
    }
    out[i * ch + 0] = half(aR).bits();
    out[i * ch + 1] = half(aG).bits();
    out[i * ch + 2] = half(aB).bits();
    if (ch == 4) out[i * ch + 3] = half(aA).bits();
  }

  DecodeResult* r =
      static_cast<DecodeResult*>(std::calloc(1, sizeof(DecodeResult)));
  r->status = 0;
  r->width = width;
  r->height = height;
  r->channels = ch;
  r->precision = PREC_F16BITS;
  r->data_ptr = (int32_t)reinterpret_cast<intptr_t>(out);
  r->data_len = (int)(pixels * ch);
  return r;
}

// Validate a deep header's channel layout and populate a fresh DeepHandle's
// dims/flags. Returns nullptr on success (writing `err`), else an owned error.
DecodeResult* prepareDeepHandle(const Header& h, DeepHandle& hd) {
  const ChannelList& cl = h.channels();
  const Box2i& dw = h.dataWindow();
  bool hasR = hasChan(cl, "R"), hasG = hasChan(cl, "G"), hasB = hasChan(cl, "B");
  if (!(hasR && hasG && hasB)) {
    std::string list;
    for (auto it = cl.begin(); it != cl.end(); ++it) {
      if (!list.empty()) list += ",";
      list += it.name();
    }
    return makeError("unsupported-channel-layout",
                     "deep image without R,G,B [" + list + "]");
  }
  hd.hasA = hasChan(cl, "A");
  hd.hasZ = hasChan(cl, "Z");
  hd.channels = hd.hasA ? 4 : 3;
  hd.width = dw.max.x - dw.min.x + 1;
  hd.height = dw.max.y - dw.min.y + 1;
  return nullptr;
}

// One-shot deep decode (full composite, zClip = +inf): the legacy path used by
// `cairn_exr_decode`'s inline/fallback callers and the pure-TS parity tests.
// Opens, reads, flattens at zMax (all samples), frees — one flatten impl.
DecodeResult* decodeDeep(MultiPartInputFile& mfile, const Header& h,
                         bool tiled) {
  DeepHandle hd;
  DecodeResult* err = prepareDeepHandle(h, hd);
  if (err) return err;
  readDeepInto(mfile, h, tiled, hd);
  return flattenHandle(hd, -std::numeric_limits<float>::infinity(),
                       std::numeric_limits<float>::infinity());
}

// Export a handle's samples PER-PIXEL Z-SORTED into GPU-upload-ready arrays:
// offsets (u32, pixels+1), colors (f32, 4·total premultiplied RGBA), z (f32,
// total). Alpha defaults to 1 when the source has no A; Z defaults to 0 when the
// source has no Z (then the slider clips nothing — every sample is included).
DeepGpuCsr* emitGpuCsr(const DeepHandle& hd) {
  size_t pixels = (size_t)hd.width * hd.height;
  size_t total = hd.totalSamples();
  uint32_t* offsets = static_cast<uint32_t*>(std::malloc((pixels + 1) * sizeof(uint32_t)));
  float* colors = static_cast<float*>(std::malloc((total ? total : 1) * 4 * sizeof(float)));
  float* zs = static_cast<float*>(std::malloc((total ? total : 1) * sizeof(float)));

  std::vector<int> order;
  for (size_t i = 0; i < pixels; ++i) {
    offsets[i] = hd.offsets[i];
    uint32_t off = hd.offsets[i];
    unsigned int n = hd.offsets[i + 1] - off;
    order.resize(n);
    for (unsigned int s = 0; s < n; ++s) order[s] = (int)s;
    if (hd.hasZ && n > 1) {
      const float* z = &hd.Z[off];
      std::sort(order.begin(), order.end(),
                [&](int a, int b) { return z[a] < z[b]; });
    }
    for (unsigned int k = 0; k < n; ++k) {
      int s = order[k];
      size_t o = (size_t)(off + k);
      colors[o * 4 + 0] = hd.R[off + s];
      colors[o * 4 + 1] = hd.G[off + s];
      colors[o * 4 + 2] = hd.B[off + s];
      colors[o * 4 + 3] = hd.hasA ? hd.A[off + s] : 1.0f;
      zs[o] = hd.hasZ ? hd.Z[off + s] : 0.0f;
    }
  }
  offsets[pixels] = hd.offsets[pixels];

  DeepGpuCsr* r = static_cast<DeepGpuCsr*>(std::calloc(1, sizeof(DeepGpuCsr)));
  r->status = 0;
  r->offsets_ptr = (int32_t)reinterpret_cast<intptr_t>(offsets);
  r->colors_ptr = (int32_t)reinterpret_cast<intptr_t>(colors);
  r->z_ptr = (int32_t)reinterpret_cast<intptr_t>(zs);
  r->total = (int32_t)total;
  r->width = hd.width;
  r->height = hd.height;
  return r;
}

// Z range of all samples inside the image-pixel rect [x0,x1]×[y0,y1] (inclusive,
// clamped to the image; args are swapped if inverted). Returns count=0 for an
// empty region. Missing Z ⇒ all samples treated as Z=0.
DeepZRange* zRangeInRect(const DeepHandle& hd, int x0, int y0, int x1, int y1) {
  if (x1 < x0) std::swap(x0, x1);
  if (y1 < y0) std::swap(y0, y1);
  x0 = std::max(0, std::min(x0, hd.width - 1));
  x1 = std::max(0, std::min(x1, hd.width - 1));
  y0 = std::max(0, std::min(y0, hd.height - 1));
  y1 = std::max(0, std::min(y1, hd.height - 1));
  float lo = 0, hi = 0;
  int32_t count = 0;
  for (int y = y0; y <= y1; ++y) {
    for (int x = x0; x <= x1; ++x) {
      size_t i = (size_t)y * hd.width + x;
      uint32_t off = hd.offsets[i];
      unsigned int n = hd.offsets[i + 1] - off;
      for (unsigned int s = 0; s < n; ++s) {
        float z = hd.hasZ ? hd.Z[off + s] : 0.0f;
        if (count == 0) { lo = z; hi = z; }
        else { if (z < lo) lo = z; if (z > hi) hi = z; }
        ++count;
      }
    }
  }
  DeepZRange* r = static_cast<DeepZRange*>(std::calloc(1, sizeof(DeepZRange)));
  r->status = 0;
  r->z_min = lo;
  r->z_max = hi;
  r->count = count;
  return r;
}

}  // namespace

extern "C" {

// Decode an OpenEXR file. Never throws across the ABI: failures come back as a
// DecodeResult with status=1 and err_code/err_msg C strings.
DecodeResult* cairn_exr_decode(const uint8_t* bytes, int len) {
  try {
    MemIStream stream(reinterpret_cast<const char*>(bytes), (uint64_t)len);
    MultiPartInputFile mfile(stream);
    const Header& h = mfile.header(0);
    std::string type = h.hasType() ? h.type() : std::string(SCANLINEIMAGE);

    if (type == DEEPSCANLINE || type == DEEPTILE)
      return decodeDeep(mfile, h, type == DEEPTILE);

    ChannelPlan plan;
    std::string err;
    if (!planChannels(h.channels(), plan, err))
      return makeError("unsupported-channel-layout", err);

    if (plan.lumaChroma) return decodeLumaChroma(stream, plan);
    return decodeFlat(mfile, h, plan);
  } catch (const std::exception& e) {
    return makeError("decode-error", std::string("cairn-exr: ") + e.what());
  } catch (...) {
    return makeError("decode-error", "cairn-exr: unknown decode failure");
  }
}

void cairn_exr_free(DecodeResult* r) {
  if (!r) return;
  if (r->data_ptr) std::free(reinterpret_cast<void*>((intptr_t)r->data_ptr));
  if (r->err_code) std::free(reinterpret_cast<void*>((intptr_t)r->err_code));
  if (r->err_msg) std::free(reinterpret_cast<void*>((intptr_t)r->err_msg));
  std::free(r);
}

// ---------------------------------------------------------------------------
// DEEP live-flatten ABI. See DeepOpenResult / DeepHandle above.
// ---------------------------------------------------------------------------

static DeepOpenResult* makeDeepError(const std::string& code, const std::string& msg) {
  DeepOpenResult* r =
      static_cast<DeepOpenResult*>(std::calloc(1, sizeof(DeepOpenResult)));
  r->status = 1;
  r->err_code = (int32_t)reinterpret_cast<intptr_t>(dupCStr(code));
  r->err_msg = (int32_t)reinterpret_cast<intptr_t>(dupCStr(msg));
  return r;
}

// Parse a DEEP OpenEXR, read + RETAIN its samples behind an opaque handle, and
// report {width,height,channels,zMin,zMax,totalSamples}. A non-deep or
// unsupported file returns status=1 with err_code/err_msg (the host then routes
// it through the ordinary one-shot `cairn_exr_decode`). Never throws across ABI.
DeepOpenResult* cairn_exr_open_deep(const uint8_t* bytes, int len) {
  DeepHandle* hd = nullptr;
  try {
    MemIStream stream(reinterpret_cast<const char*>(bytes), (uint64_t)len);
    MultiPartInputFile mfile(stream);
    const Header& h = mfile.header(0);
    std::string type = h.hasType() ? h.type() : std::string(SCANLINEIMAGE);
    if (type != DEEPSCANLINE && type != DEEPTILE)
      return makeDeepError("not-deep", "cairn-exr: not a deep image");

    hd = new DeepHandle();
    DecodeResult* perr = prepareDeepHandle(h, *hd);
    if (perr) {
      std::string code = perr->err_code
          ? std::string(reinterpret_cast<char*>((intptr_t)perr->err_code)) : "decode-error";
      std::string msg = perr->err_msg
          ? std::string(reinterpret_cast<char*>((intptr_t)perr->err_msg)) : "";
      cairn_exr_free(perr);
      delete hd;
      return makeDeepError(code, msg);
    }
    // One full read: validates the file, fills the CSR arrays, and yields the
    // Z range + total sample count.
    readDeepInto(mfile, h, type == DEEPTILE, *hd);

    // Retention-first: ALWAYS keep the compressed bytes (redecode-on-evict
    // source), then register the CSR with the global LRU byte budget. If total
    // retained CSR now exceeds the budget, the least-recently-used handles
    // (possibly including this one, if it alone is huge) are evicted to
    // redecode mode — nothing breaks, those files just re-decode on flatten.
    hd->fileBytes.assign(bytes, bytes + len);
    deepRetainRegister(hd);

    DeepOpenResult* r =
        static_cast<DeepOpenResult*>(std::calloc(1, sizeof(DeepOpenResult)));
    r->status = 0;
    r->handle = (int32_t)reinterpret_cast<intptr_t>(hd);
    r->width = hd->width;
    r->height = hd->height;
    r->channels = hd->channels;
    r->z_min = hd->zMin;
    r->z_max = hd->zMax;
    r->total_samples = (int32_t)hd->totalSamples();
    return r;
  } catch (const std::exception& e) {
    delete hd;
    return makeDeepError("decode-error", std::string("cairn-exr: ") + e.what());
  } catch (...) {
    delete hd;
    return makeDeepError("decode-error", "cairn-exr: unknown deep open failure");
  }
}

// Flatten a retained deep handle over the Z WINDOW [zNear, zFar] into a flat
// f16 RGBA DecodeResult (freed via cairn_exr_free like any decode).
// zNear = -inf, zFar = +inf ⇒ full composite; zNear = -inf alone ⇒ the legacy
// single far-cutoff (bit-exact).
DecodeResult* cairn_exr_flatten_deep(DeepHandle* hd, float zNear, float zFar) {
  try {
    if (!hd) return makeError("decode-error", "cairn-exr: null deep handle");
    if (hd->retained) {
      deepTouch(hd);  // mark most-recently-used for the LRU
      return flattenHandle(*hd, zNear, zFar);
    }
    // Evicted (or over-budget) handle: re-decode the samples from the cached
    // bytes into a scratch handle, flatten, discard.
    MemIStream stream(reinterpret_cast<const char*>(hd->fileBytes.data()),
                      (uint64_t)hd->fileBytes.size());
    MultiPartInputFile mfile(stream);
    const Header& h = mfile.header(0);
    std::string type = h.hasType() ? h.type() : std::string(SCANLINEIMAGE);
    DeepHandle scratch;
    DecodeResult* perr = prepareDeepHandle(h, scratch);
    if (perr) return perr;
    readDeepInto(mfile, h, type == DEEPTILE, scratch);
    return flattenHandle(scratch, zNear, zFar);
  } catch (const std::exception& e) {
    return makeError("decode-error", std::string("cairn-exr: ") + e.what());
  } catch (...) {
    return makeError("decode-error", "cairn-exr: unknown deep flatten failure");
  }
}

static DeepGpuCsr* makeGpuCsrError(const std::string& code, const std::string& msg) {
  DeepGpuCsr* r = static_cast<DeepGpuCsr*>(std::calloc(1, sizeof(DeepGpuCsr)));
  r->status = 1;
  r->err_code = (int32_t)reinterpret_cast<intptr_t>(dupCStr(code));
  r->err_msg = (int32_t)reinterpret_cast<intptr_t>(dupCStr(msg));
  return r;
}

// Export a retained deep handle's Z-sorted samples for GPU upload (see
// DeepGpuCsr). Works on an evicted handle too — it re-decodes from the cached
// bytes into a scratch handle first. Never throws across the ABI.
DeepGpuCsr* cairn_exr_deep_gpu_csr(DeepHandle* hd) {
  try {
    if (!hd) return makeGpuCsrError("decode-error", "cairn-exr: null deep handle");
    if (hd->retained) return emitGpuCsr(*hd);
    MemIStream stream(reinterpret_cast<const char*>(hd->fileBytes.data()),
                      (uint64_t)hd->fileBytes.size());
    MultiPartInputFile mfile(stream);
    const Header& h = mfile.header(0);
    std::string type = h.hasType() ? h.type() : std::string(SCANLINEIMAGE);
    DeepHandle scratch;
    DecodeResult* perr = prepareDeepHandle(h, scratch);
    if (perr) {
      cairn_exr_free(perr);
      return makeGpuCsrError("unsupported-channel-layout", "cairn-exr: deep gpu csr layout");
    }
    readDeepInto(mfile, h, type == DEEPTILE, scratch);
    return emitGpuCsr(scratch);
  } catch (const std::exception& e) {
    return makeGpuCsrError("decode-error", std::string("cairn-exr: ") + e.what());
  } catch (...) {
    return makeGpuCsrError("decode-error", "cairn-exr: unknown deep gpu csr failure");
  }
}

// Free a DeepGpuCsr (its three arrays + the struct + any error strings).
void cairn_exr_free_gpu_csr(DeepGpuCsr* r) {
  if (!r) return;
  if (r->offsets_ptr) std::free(reinterpret_cast<void*>((intptr_t)r->offsets_ptr));
  if (r->colors_ptr) std::free(reinterpret_cast<void*>((intptr_t)r->colors_ptr));
  if (r->z_ptr) std::free(reinterpret_cast<void*>((intptr_t)r->z_ptr));
  if (r->err_code) std::free(reinterpret_cast<void*>((intptr_t)r->err_code));
  if (r->err_msg) std::free(reinterpret_cast<void*>((intptr_t)r->err_msg));
  std::free(r);
}

static DeepZRange* makeZRangeError(const std::string& code, const std::string& msg) {
  DeepZRange* r = static_cast<DeepZRange*>(std::calloc(1, sizeof(DeepZRange)));
  r->status = 1;
  r->err_code = (int32_t)reinterpret_cast<intptr_t>(dupCStr(code));
  r->err_msg = (int32_t)reinterpret_cast<intptr_t>(dupCStr(msg));
  return r;
}

// Z range of samples inside an image-pixel rect (region-select → depth window).
// Works on an evicted handle too (one-shot re-decode — it's a discrete action).
DeepZRange* cairn_exr_deep_z_range_in_rect(DeepHandle* hd, int x0, int y0, int x1, int y1) {
  try {
    if (!hd) return makeZRangeError("decode-error", "cairn-exr: null deep handle");
    if (hd->retained) return zRangeInRect(*hd, x0, y0, x1, y1);
    MemIStream stream(reinterpret_cast<const char*>(hd->fileBytes.data()),
                      (uint64_t)hd->fileBytes.size());
    MultiPartInputFile mfile(stream);
    const Header& h = mfile.header(0);
    std::string type = h.hasType() ? h.type() : std::string(SCANLINEIMAGE);
    DeepHandle scratch;
    DecodeResult* perr = prepareDeepHandle(h, scratch);
    if (perr) {
      cairn_exr_free(perr);
      return makeZRangeError("unsupported-channel-layout", "cairn-exr: deep z-range layout");
    }
    readDeepInto(mfile, h, type == DEEPTILE, scratch);
    return zRangeInRect(scratch, x0, y0, x1, y1);
  } catch (const std::exception& e) {
    return makeZRangeError("decode-error", std::string("cairn-exr: ") + e.what());
  } catch (...) {
    return makeZRangeError("decode-error", "cairn-exr: unknown deep z-range failure");
  }
}

// Free a DeepZRange struct (+ any error strings).
void cairn_exr_free_z_range(DeepZRange* r) {
  if (!r) return;
  if (r->err_code) std::free(reinterpret_cast<void*>((intptr_t)r->err_code));
  if (r->err_msg) std::free(reinterpret_cast<void*>((intptr_t)r->err_msg));
  std::free(r);
}

// Free the DeepOpenResult struct (+ its error strings). Does NOT free the
// retained handle — call cairn_exr_free_deep for that when the pane unmounts.
void cairn_exr_free_open_deep(DeepOpenResult* r) {
  if (!r) return;
  if (r->err_code) std::free(reinterpret_cast<void*>((intptr_t)r->err_code));
  if (r->err_msg) std::free(reinterpret_cast<void*>((intptr_t)r->err_msg));
  std::free(r);
}

// Release a retained deep handle (frees all retained samples + cached bytes).
void cairn_exr_free_deep(DeepHandle* hd) {
  if (!hd) return;
  deepUnregister(hd);
  delete hd;
}

// Set the global deep-retention LRU byte budget (default 512 MB). Lowering it
// evicts LRU handles to redecode mode immediately; used by the eviction test.
void cairn_exr_set_deep_budget(double bytes) {
  g_deepBudget = bytes < 0 ? 0 : (size_t)bytes;
  deepEvictToBudget(nullptr);
}

}  // extern "C"
