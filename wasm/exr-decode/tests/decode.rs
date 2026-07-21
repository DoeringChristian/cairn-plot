//! Native `cargo test` for the pure decode core. Decodes the committed PIZ
//! fixture and asserts dims/channels/precision + exact half-bit pixel values
//! against the same ground truth the TS test uses.

use cairn_exr_decode::decode::{decode, DecodeError, Precision};
use exr::prelude::*;
use std::io::Cursor;

/// Path to the committed fixture shared with the TS decoder tests.
const FIXTURE: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../ui/src/lib/cairn-plot/image/decoders/fixtures/rgb-piz-half-64x48.exr"
);

fn half_to_f32(bits: u16) -> f32 {
    half::f16::from_bits(bits).to_f32()
}

#[test]
fn piz_fixture_decodes_bit_exact() {
    let bytes = std::fs::read(FIXTURE).expect("read fixture");
    let d = decode(&bytes).expect("decode PIZ fixture");

    assert_eq!(d.width, 64);
    assert_eq!(d.height, 48);
    assert_eq!(d.channels, 3, "RGB, no alpha");
    assert_eq!(d.precision, Precision::F16Bits, "HALF source stays half bits");

    let bits = d.f16_bits.as_ref().expect("half payload");
    assert_eq!(bits.len(), 64 * 48 * 3);
    assert!(d.f32.is_none());

    // Interleaved, top-to-bottom: (x,y,c) at (y*64 + x)*3 + c.
    let px = |x: usize, y: usize| {
        let i = (y * 64 + x) * 3;
        [
            half_to_f32(bits[i]),
            half_to_f32(bits[i + 1]),
            half_to_f32(bits[i + 2]),
        ]
    };
    // Ground truth (OpenEXR 3.4): R=(x*0.5)%8, G=(y*0.25)%4, B=((x+y)%16)*0.125.
    assert_eq!(px(0, 0), [0.0, 0.0, 0.0]);
    assert_eq!(px(1, 0), [0.5, 0.0, 0.125]);
    assert_eq!(px(5, 10), [2.5, 2.5, 1.875]);
    assert_eq!(px(7, 20), [3.5, 1.0, 1.375]);

    assert!(
        bits.iter().all(|&b| half_to_f32(b).is_finite()),
        "all samples finite"
    );
}

#[test]
fn ground_truth_matches_formula_everywhere() {
    let bytes = std::fs::read(FIXTURE).expect("read fixture");
    let d = decode(&bytes).expect("decode");
    let bits = d.f16_bits.unwrap();
    for y in 0..48usize {
        for x in 0..64usize {
            let i = (y * 64 + x) * 3;
            let r = half_to_f32(bits[i]);
            let g = half_to_f32(bits[i + 1]);
            let b = half_to_f32(bits[i + 2]);
            let er = ((x as f32) * 0.5) % 8.0;
            let eg = ((y as f32) * 0.25) % 4.0;
            let eb = (((x + y) % 16) as f32) * 0.125;
            assert_eq!((r, g, b), (er, eg, eb), "pixel ({x},{y})");
        }
    }
}

// ---------------------------------------------------------------------------
// Compression coverage: every method exrs supports round-trips through decode()
// bit-exact (values are exactly representable in half). This is the evidence
// behind the "DWAA/DWAB ARE supported" report claim.
// ---------------------------------------------------------------------------
fn write_rgb_half(comp: Compression, w: usize, h: usize) -> Vec<u8> {
    let ch = SpecificChannels::rgb(|p: Vec2<usize>| {
        let x = p.0;
        let y = p.1;
        let r = ((x as f32) * 0.5) % 8.0;
        let g = ((y as f32) * 0.25) % 4.0;
        let b = (((x + y) % 16) as f32) * 0.125;
        (f16::from_f32(r), f16::from_f32(g), f16::from_f32(b))
    });
    let mut img = Image::from_channels((w, h), ch);
    img.layer_data.encoding.compression = comp;
    let mut buf = Vec::new();
    img.write().to_buffered(Cursor::new(&mut buf)).expect("write EXR");
    buf
}

fn assert_rgb_formula(bytes: &[u8], w: usize, h: usize, lossy: bool) {
    let d = decode(bytes).expect("decode");
    assert_eq!((d.width, d.height, d.channels), (w, h, 3));
    let bits = d.f16_bits.expect("half payload");
    for y in 0..h {
        for x in 0..w {
            let i = (y * w + x) * 3;
            let r = half::f16::from_bits(bits[i]).to_f32();
            let g = half::f16::from_bits(bits[i + 1]).to_f32();
            let b = half::f16::from_bits(bits[i + 2]).to_f32();
            let er = ((x as f32) * 0.5) % 8.0;
            let eg = ((y as f32) * 0.25) % 4.0;
            let eb = (((x + y) % 16) as f32) * 0.125;
            if lossy {
                assert!((r - er).abs() <= 0.5 && (g - eg).abs() <= 0.5 && (b - eb).abs() <= 0.5,
                    "lossy pixel ({x},{y}): got {r},{g},{b} want {er},{eg},{eb}");
            } else {
                assert_eq!((r, g, b), (er, eg, eb), "pixel ({x},{y})");
            }
        }
    }
}

#[test]
fn all_supported_compressions_decode() {
    let (w, h) = (40usize, 40usize);
    // Lossless — bit-exact.
    for comp in [
        Compression::Uncompressed,
        Compression::RLE,
        Compression::ZIP1,
        Compression::ZIP16,
        Compression::PIZ,
    ] {
        assert_rgb_formula(&write_rgb_half(comp, w, h), w, h, false);
    }
    // Lossy — close (this proves DWAA/DWAB are DECODED, not rejected).
    for comp in [
        Compression::PXR24,
        Compression::B44,
        Compression::B44A,
        Compression::DWAA(None),
        Compression::DWAB(None),
    ] {
        assert_rgb_formula(&write_rgb_half(comp, w, h), w, h, true);
    }
}

#[test]
fn garbage_is_a_parse_error() {
    let err = decode(&[0u8; 16]).unwrap_err();
    assert!(matches!(err, DecodeError::Parse(_)), "got {err:?}");
    assert_eq!(err.code(), "parse-error");
}
