//! Native helper: write a big synthetic PIZ / HALF RGB EXR for benchmarking.
//! Usage: `cargo run --release --bin gen_fixture -- <out.exr> [size]`
//! (size defaults to 1024 → 1024x1024). Pixel values follow the same formula as
//! the committed 64x48 fixture so they are exactly representable in half:
//!   R=(x*0.5)%8, G=(y*0.25)%4, B=((x+y)%16)*0.125.

use exr::prelude::*;

fn main() {
    let mut args = std::env::args().skip(1);
    let out = args.next().expect("usage: gen_fixture <out.exr> [size]");
    let size: usize = args.next().map(|s| s.parse().expect("size")).unwrap_or(1024);

    let channels = SpecificChannels::rgb(|pos: Vec2<usize>| {
        let x = pos.0;
        let y = pos.1;
        let r = ((x as f32) * 0.5) % 8.0;
        let g = ((y as f32) * 0.25) % 4.0;
        let b = (((x + y) % 16) as f32) * 0.125;
        (f16::from_f32(r), f16::from_f32(g), f16::from_f32(b))
    });

    let mut image = Image::from_channels((size, size), channels);
    image.layer_data.encoding.compression = Compression::PIZ;

    image.write().to_file(&out).expect("write EXR");
    eprintln!("wrote {out} ({size}x{size}, PIZ, HALF RGB)");
}
