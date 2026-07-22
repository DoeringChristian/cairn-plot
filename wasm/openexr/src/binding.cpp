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

// ----- Deep (scanline or tiled) → flatten to premultiplied RGBA(A) half ----
//
// Simplified display flatten per OpenEXR's "Interpreting Deep Pixels": each
// pixel's samples are sorted front-to-back by Z (deep samples are treated as
// point samples at their Z; overlapping VOLUME samples are NOT split/tidied —
// documented simplification adequate for display) and composited with the OVER
// operator assuming associated (premultiplied) alpha, yielding a flat
// premultiplied RGBA image. Missing A ⇒ opaque (a=1); missing Z ⇒ file order.
DecodeResult* decodeDeep(MultiPartInputFile& mfile, const Header& h,
                         bool tiled) {
  const ChannelList& cl = h.channels();
  const Box2i& dw = h.dataWindow();
  int width = dw.max.x - dw.min.x + 1;
  int height = dw.max.y - dw.min.y + 1;
  size_t pixels = (size_t)width * height;

  bool hasR = hasChan(cl, "R"), hasG = hasChan(cl, "G"), hasB = hasChan(cl, "B");
  bool hasA = hasChan(cl, "A"), hasZ = hasChan(cl, "Z");
  if (!(hasR && hasG && hasB)) {
    std::string list;
    for (auto it = cl.begin(); it != cl.end(); ++it) {
      if (!list.empty()) list += ",";
      list += it.name();
    }
    return makeError("unsupported-channel-layout",
                     "deep image without R,G,B [" + list + "]");
  }
  int ch = hasA ? 4 : 3;

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
  // Allocate per-pixel sample storage now that counts are known.
  for (size_t i = 0; i < pixels; ++i) {
    int y = (int)(i / width), x = (int)(i % width);
    unsigned int n = counts[y][x];
    rp[y][x] = n ? new float[n] : nullptr;
    gp[y][x] = n ? new float[n] : nullptr;
    bp[y][x] = n ? new float[n] : nullptr;
    if (hasA) ap[y][x] = n ? new float[n] : nullptr;
    if (hasZ) zp[y][x] = n ? new float[n] : nullptr;
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

  uint16_t* out = static_cast<uint16_t*>(
      std::malloc(pixels * ch * sizeof(uint16_t)));
  std::vector<int> order;
  for (size_t i = 0; i < pixels; ++i) {
    int y = (int)(i / width), x = (int)(i % width);
    unsigned int n = counts[y][x];
    order.resize(n);
    for (unsigned int s = 0; s < n; ++s) order[s] = (int)s;
    if (hasZ && n > 1) {
      float* z = zp[y][x];
      std::sort(order.begin(), order.end(),
                [&](int a, int b) { return z[a] < z[b]; });
    }
    float aR = 0, aG = 0, aB = 0, aA = 0;
    for (unsigned int k = 0; k < n; ++k) {
      int s = order[k];
      float sa = hasA ? ap[y][x][s] : 1.0f;
      float w = 1.0f - aA;  // front-to-back OVER, associated alpha
      aR += w * rp[y][x][s];
      aG += w * gp[y][x][s];
      aB += w * bp[y][x][s];
      aA += w * sa;
    }
    out[i * ch + 0] = half(aR).bits();
    out[i * ch + 1] = half(aG).bits();
    out[i * ch + 2] = half(aB).bits();
    if (ch == 4) out[i * ch + 3] = half(aA).bits();
    delete[] rp[y][x];
    delete[] gp[y][x];
    delete[] bp[y][x];
    if (hasA) delete[] ap[y][x];
    if (hasZ) delete[] zp[y][x];
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

}  // extern "C"
