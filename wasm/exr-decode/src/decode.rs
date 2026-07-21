//! Pure (non-wasm) OpenEXR decode core, shared by the wasm-bindgen wrapper
//! (`src/wasm.rs`) and native `cargo test`. Produces cairn-plot's canonical
//! image layout so Phase B can hand it straight to the HDR path.
//!
//! ## Output format (DOCUMENTED — this is the contract Phase B wires)
//!
//! - **Interleaved**, **top-to-bottom**, **row-major**: sample `(x, y, c)` lives
//!   at flat index `(y * width + x) * channels + c`. This matches cairn-plot's
//!   `DecodedImage` (`data[i * channels + c]`) exactly — no transpose/flip needed
//!   downstream. (The three.js/TS decoder flips rows because three stores
//!   bottom-to-top; the `exr` crate is already top-to-bottom, like our canonical
//!   layout, so we do NOT flip.)
//! - **Channel compaction** mirrors the TS `planChannels`: `R,G,B(,A)` →
//!   3 or 4 channels in R,G,B(,A) order; a single channel → 1. Other layouts
//!   (e.g. luminance-chroma Y/RY/BY, which needs chroma reconstruction the
//!   `exr` crate does not do) return [`DecodeError::UnsupportedChannelLayout`]
//!   so the JS caller can fall back to the TS decoder.
//! - **Precision** minimizes copies & preserves bits:
//!   - all selected channels HALF → [`Precision::F16Bits`], payload is the raw
//!     IEEE-754 half **bit patterns** (`u16`), i.e. bit-exact with the file (no
//!     f16→f32 expansion — the GPU HDR path can upload these as half textures).
//!   - otherwise (any FLOAT, any UINT, or mixed) → [`Precision::F32`], all
//!     samples promoted to `f32`.
//!
//! The interleave is a single pass over the samples we must copy out of the
//! `exr` crate's per-channel `Vec`s anyway, so it adds no extra allocation
//! beyond the one output buffer.

use std::io::Cursor;

use exr::prelude::*;
// `exr::prelude` re-exports a 1-arg `Result<T>` alias; bring std's 2-arg back.
use std::result::Result;

/// Payload precision of a [`Decoded`] image.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Precision {
    /// Raw IEEE half (`f16`) bit patterns, one `u16` per sample. Bit-exact.
    F16Bits,
    /// 32-bit floats, one `f32` per sample.
    F32,
}

impl Precision {
    /// The stable string the JS side sees (`DecodedImage.precision`).
    pub fn as_str(self) -> &'static str {
        match self {
            Precision::F16Bits => "f16-bits",
            Precision::F32 => "f32",
        }
    }
}

/// A decoded image in cairn-plot's canonical interleaved top-to-bottom layout.
#[derive(Debug, Clone)]
pub struct Decoded {
    pub width: usize,
    pub height: usize,
    pub channels: usize,
    pub precision: Precision,
    /// Present iff `precision == F16Bits`. Half bit patterns, interleaved.
    pub f16_bits: Option<Vec<u16>>,
    /// Present iff `precision == F32`. Floats, interleaved.
    pub f32: Option<Vec<f32>>,
}

/// Typed decode failures. The wasm wrapper maps
/// [`DecodeError::UnsupportedCompression`] /
/// [`DecodeError::UnsupportedChannelLayout`] to a JS error the caller can detect
/// and fall back to the TS decoder for; everything else is a hard parse error.
#[derive(Debug, Clone)]
pub enum DecodeError {
    /// The file uses a compression the `exr` crate cannot decode. In exrs
    /// 1.74.2 the only such methods are HTJ2K (32/256); the full classic set
    /// (NONE/RLE/ZIP/ZIPS/PIZ/PXR24/B44/B44A **and** DWAA/DWAB) IS decoded.
    /// Carries the exrs message (e.g. `"…ht j2k 32"`).
    UnsupportedCompression(String),
    /// Channel layout we do not compact (e.g. luminance-chroma Y/RY/BY).
    UnsupportedChannelLayout(String),
    /// Malformed / unreadable EXR, or an otherwise unsupported feature.
    Parse(String),
}

impl DecodeError {
    /// Machine-readable code the JS side branches on.
    pub fn code(&self) -> &'static str {
        match self {
            DecodeError::UnsupportedCompression(_) => "unsupported-compression",
            DecodeError::UnsupportedChannelLayout(_) => "unsupported-channel-layout",
            DecodeError::Parse(_) => "parse-error",
        }
    }

    pub fn message(&self) -> String {
        match self {
            DecodeError::UnsupportedCompression(t) => {
                format!("cairn-exr-decode: unsupported compression '{t}' (fall back to TS decoder)")
            }
            DecodeError::UnsupportedChannelLayout(t) => {
                format!("cairn-exr-decode: unsupported channel layout '{t}' (fall back to TS decoder)")
            }
            DecodeError::Parse(m) => format!("cairn-exr-decode: {m}"),
        }
    }
}

impl std::fmt::Display for DecodeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.message())
    }
}
impl std::error::Error for DecodeError {}

/// Which source channels to emit, and in what order, plus output count.
struct ChannelPlan {
    /// Indices into the (alphabetically-sorted) channel list, in output order.
    slots: Vec<usize>,
    out_channels: usize,
}

/// Mirror the TS `planChannels`: R,G,B(,A) → 3/4; single → 1; else unsupported.
fn plan_channels(names: &[String]) -> Result<ChannelPlan, DecodeError> {
    let find = |n: &str| names.iter().position(|c| c == n);

    let has_ycbcr = find("Y").is_some() && find("RY").is_some() && find("BY").is_some();
    if has_ycbcr {
        return Err(DecodeError::UnsupportedChannelLayout("luminance-chroma".into()));
    }

    if let (Some(r), Some(g), Some(b)) = (find("R"), find("G"), find("B")) {
        if let Some(a) = find("A") {
            return Ok(ChannelPlan { slots: vec![r, g, b, a], out_channels: 4 });
        }
        return Ok(ChannelPlan { slots: vec![r, g, b], out_channels: 3 });
    }

    if names.len() == 1 {
        return Ok(ChannelPlan { slots: vec![0], out_channels: 1 });
    }

    Err(DecodeError::UnsupportedChannelLayout(format!(
        "channels [{}]",
        names.join(",")
    )))
}

/// Map an `exr` crate error to our typed error.
///
/// exrs 1.74.2 decodes the FULL classic compression set (NONE, RLE, ZIP,
/// ZIPS, PIZ, PXR24, B44, B44A **and** DWAA/DWAB — all verified). The only
/// genuinely-unimplemented methods are HTJ2K (32/256), which surface as
/// `Error::NotSupported("yet unimplemented compression method: ht j2k …")`. We
/// classify any "not supported" mentioning compression as
/// [`DecodeError::UnsupportedCompression`] so the JS caller can fall back to the
/// TS decoder for those; other "not supported" cases are hard parse errors.
fn map_exr_err(err: exr::error::Error) -> DecodeError {
    use exr::error::Error as E;
    match err {
        E::NotSupported(msg) => {
            let low = msg.to_lowercase();
            if low.contains("compress") || low.contains("j2k") || low.contains("dwa") {
                DecodeError::UnsupportedCompression(msg.to_string())
            } else {
                DecodeError::Parse(format!("not supported: {msg}"))
            }
        }
        other => DecodeError::Parse(other.to_string()),
    }
}

/// Decode EXR bytes into the canonical interleaved layout. See module docs.
pub fn decode(bytes: &[u8]) -> Result<Decoded, DecodeError> {
    let image = read()
        .no_deep_data()
        .largest_resolution_level()
        .all_channels()
        .first_valid_layer()
        .all_attributes()
        .non_parallel()
        .from_buffered(Cursor::new(bytes))
        .map_err(map_exr_err)?;

    let layer = &image.layer_data;
    let width = layer.size.0;
    let height = layer.size.1;
    let pixels = width * height;

    let channels = &layer.channel_data.list;
    let names: Vec<String> = channels.iter().map(|c| c.name.to_string()).collect();
    let plan = plan_channels(&names)?;

    // Precision: F16Bits iff every selected channel is HALF; else F32.
    let all_half = plan
        .slots
        .iter()
        .all(|&i| matches!(channels[i].sample_data, FlatSamples::F16(_)));

    let out_ch = plan.out_channels;

    if all_half {
        let mut out = vec![0u16; pixels * out_ch];
        for (c, &slot) in plan.slots.iter().enumerate() {
            let FlatSamples::F16(src) = &channels[slot].sample_data else {
                unreachable!("checked all_half");
            };
            for p in 0..pixels {
                out[p * out_ch + c] = src[p].to_bits();
            }
        }
        Ok(Decoded {
            width,
            height,
            channels: out_ch,
            precision: Precision::F16Bits,
            f16_bits: Some(out),
            f32: None,
        })
    } else {
        let mut out = vec![0f32; pixels * out_ch];
        for (c, &slot) in plan.slots.iter().enumerate() {
            let sd = &channels[slot].sample_data;
            match sd {
                FlatSamples::F16(src) => {
                    for p in 0..pixels {
                        out[p * out_ch + c] = src[p].to_f32();
                    }
                }
                FlatSamples::F32(src) => {
                    for p in 0..pixels {
                        out[p * out_ch + c] = src[p];
                    }
                }
                FlatSamples::U32(src) => {
                    for p in 0..pixels {
                        out[p * out_ch + c] = src[p] as f32;
                    }
                }
            }
        }
        Ok(Decoded {
            width,
            height,
            channels: out_ch,
            precision: Precision::F32,
            f16_bits: None,
            f32: Some(out),
        })
    }
}
