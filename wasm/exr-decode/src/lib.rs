//! cairn-exr-decode — Rust→WASM OpenEXR decode core for cairn-plot (Phase A).
//!
//! `decode::decode(&[u8])` is the pure core (native-testable). The wasm-bindgen
//! surface lives in `wasm` and is only compiled for `wasm32`.

pub mod decode;

#[cfg(target_arch = "wasm32")]
mod wasm;
