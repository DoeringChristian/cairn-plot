//! wasm-bindgen surface. Compiled only for `wasm32` (see `lib.rs`).
//!
//! Exposes `decode_exr(bytes: &[u8]) -> DecodedImage`. The payload crosses the
//! wasm→JS boundary as a genuine JS typed array (`Uint16Array` of half bits for
//! HALF sources, `Float32Array` otherwise) — one copy out of wasm linear memory
//! into a transferable `ArrayBuffer` (so a Worker can `postMessage` it with zero
//! further copies). See `decode.rs` for the interleaved/top-to-bottom layout.

use js_sys::{Float32Array, Uint16Array};
use wasm_bindgen::prelude::*;

use crate::decode::{self, Precision};

/// A decoded EXR image handed to JS. `precision` is `"f16-bits"` or `"f32"`;
/// read `halfBits` when it is `"f16-bits"`, else `floats`.
#[wasm_bindgen]
pub struct DecodedImage {
    width: u32,
    height: u32,
    channels: u32,
    precision: String,
    half_bits: Option<Uint16Array>,
    floats: Option<Float32Array>,
}

#[wasm_bindgen]
impl DecodedImage {
    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.width
    }
    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.height
    }
    #[wasm_bindgen(getter)]
    pub fn channels(&self) -> u32 {
        self.channels
    }
    /// `"f16-bits"` | `"f32"`.
    #[wasm_bindgen(getter)]
    pub fn precision(&self) -> String {
        self.precision.clone()
    }
    /// Interleaved half bit patterns when `precision === "f16-bits"`, else null.
    #[wasm_bindgen(getter, js_name = halfBits)]
    pub fn half_bits(&self) -> Option<Uint16Array> {
        self.half_bits.clone()
    }
    /// Interleaved f32 samples when `precision === "f32"`, else null.
    #[wasm_bindgen(getter)]
    pub fn floats(&self) -> Option<Float32Array> {
        self.floats.clone()
    }
}

/// Decode an OpenEXR file. Throws a JS `Error` on failure; unsupported inputs
/// (HTJ2K compression, luminance-chroma layout) throw an error whose `.code` is
/// `"unsupported-compression"` / `"unsupported-channel-layout"` so the caller
/// can fall back to the TS decoder. NOTE: the full classic compression set
/// including DWAA/DWAB IS supported and decodes normally.
#[wasm_bindgen]
pub fn decode_exr(bytes: &[u8]) -> Result<DecodedImage, JsValue> {
    match decode::decode(bytes) {
        Ok(d) => {
            let (half_bits, floats) = match d.precision {
                Precision::F16Bits => {
                    let v = d.f16_bits.expect("f16 payload");
                    (Some(Uint16Array::from(&v[..])), None)
                }
                Precision::F32 => {
                    let v = d.f32.expect("f32 payload");
                    (None, Some(Float32Array::from(&v[..])))
                }
            };
            Ok(DecodedImage {
                width: d.width as u32,
                height: d.height as u32,
                channels: d.channels as u32,
                precision: d.precision.as_str().to_string(),
                half_bits,
                floats,
            })
        }
        Err(e) => Err(make_error(&e.message(), e.code())),
    }
}

/// Build a JS `Error` with an own `code` property the caller can branch on.
fn make_error(message: &str, code: &str) -> JsValue {
    let err = js_sys::Error::new(message);
    err.set_name("CairnExrDecodeError");
    // Attach a machine-readable code (e.g. "unsupported-compression").
    let _ = js_sys::Reflect::set(
        &err,
        &JsValue::from_str("code"),
        &JsValue::from_str(code),
    );
    err.into()
}
