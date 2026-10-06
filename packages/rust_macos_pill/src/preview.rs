use crate::{draw, gfx, ipc::Phase, state::PillState};
use cocoa::base::{id, nil};
use std::{ffi::c_void, path::Path};
#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGColorSpaceCreateDeviceRGB() -> *mut c_void;
    fn CGColorSpaceRelease(space: *mut c_void);
    fn CGBitmapContextCreate(
        data: *mut c_void,
        width: usize,
        height: usize,
        bits: usize,
        row: usize,
        space: *mut c_void,
        info: u32,
    ) -> gfx::CGContextRef;
    fn CGContextRelease(ctx: gfx::CGContextRef);
}
pub fn render(path: &Path) {
    unsafe {
        let _app: id = msg_send![class!(NSApplication), sharedApplication];
        let (w, h) = (1200usize, 650usize);
        let mut pixels = vec![0u8; w * h * 4];
        let space = CGColorSpaceCreateDeviceRGB();
        let cg = CGBitmapContextCreate(pixels.as_mut_ptr().cast(), w, h, 8, w * 4, space, 1);
        assert!(!cg.is_null());
        let ns: id =
            msg_send![class!(NSGraphicsContext),graphicsContextWithCGContext:cg flipped:true];
        let _: () = msg_send![class!(NSGraphicsContext),setCurrentContext:ns];
        let ctx = gfx::Ctx::new(cg);
        ctx.set_source_rgba(0.12, 0.14, 0.18, 1.0);
        ctx.rectangle(0.0, 0.0, w as f64, h as f64);
        ctx.fill();
        ctx.translate(0.0, h as f64);
        ctx.scale(1.0, -1.0);
        let styles = [
            "classic",
            "ribbon",
            "bars",
            "pulse",
            "minimal",
            "dots",
            "spectrum",
            "orb",
            "heartbeat",
            "particles",
            "liquid",
        ];
        for (i, style) in styles.iter().enumerate() {
            let state = PillState::new(1.0);
            *state.theme.borrow_mut() = rust_pill_style::ThemeInput {
                wave_style: (*style).into(),
                accent_color: "#5eead4".into(),
                accent_color_2: Some("#a78bfa".into()),
                glow: true,
                show_timer: true,
                rec_indicator: true,
                ..Default::default()
            }
            .theme();
            state.expand_t.set(1.0);
            state.phase.set(Phase::Recording);
            state.current_level.set(0.5);
            state.wave_phase.set(1.5);
            state.rainbow_clock.set(1.0);
            ctx.save();
            ctx.translate((i % 4) as f64 * 300.0, (i / 4) as f64 * 150.0);
            draw::draw_pill(&ctx, &state, 300.0, 110.0);
            ctx.set_source_rgba(1.0, 1.0, 1.0, 1.0);
            ctx.set_font_size(14.0);
            ctx.move_to(95.0, 140.0);
            ctx.show_text(style);
            ctx.restore();
        }
        for (i, style) in ["bar", "spinner", "dots"].iter().enumerate() {
            let state = PillState::new(1.0);
            *state.theme.borrow_mut() = rust_pill_style::ThemeInput {
                loading_style: (*style).into(),
                accent_color: "#f472b6".into(),
                ..Default::default()
            }
            .theme();
            state.phase.set(Phase::Loading);
            state.expand_t.set(1.0);
            state.loading_offset.set(0.4);
            ctx.save();
            ctx.translate(i as f64 * 300.0, 450.0);
            draw::draw_pill(&ctx, &state, 300.0, 110.0);
            ctx.restore();
        }
        let _: () = msg_send![class!(NSGraphicsContext),setCurrentContext:nil];
        CGContextRelease(cg);
        CGColorSpaceRelease(space);
        std::fs::write(path, pixels).unwrap();
    }
}
