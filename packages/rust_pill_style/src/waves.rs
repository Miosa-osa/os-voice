#![allow(clippy::too_many_arguments)]
use crate::{Theme, WaveStyle};
use std::f64::consts::TAU;
const MIN_AMPLITUDE: f64 = 0.03;
const MAX_AMPLITUDE: f64 = 1.3;
const STROKE_WIDTH: f64 = 1.6;
pub type Stop = (f64, f64, f64, f64, f64);
pub trait Canvas {
    fn save(&self);
    fn restore(&self);
    fn clip(&self);
    fn round_lines(&self);
    fn rounded_rect(&self, x: f64, y: f64, w: f64, h: f64, r: f64);
    fn move_to(&self, x: f64, y: f64);
    fn line_to(&self, x: f64, y: f64);
    fn arc(&self, x: f64, y: f64, r: f64, start: f64, end: f64);
    fn close_path(&self);
    fn set_source_rgba(&self, r: f64, g: f64, b: f64, a: f64);
    fn set_line_width(&self, w: f64);
    fn linear_source(&self, x1: f64, x2: f64, stops: &[Stop]);
    fn radial_source(&self, geometry: (f64, f64, f64, f64, f64, f64), stops: &[Stop]);
    fn stroke(&self);
    fn fill(&self);
}
pub struct WaveState {
    pub phase: f64,
    pub level: f64,
    pub clock: f64,
}
pub fn draw(
    cr: &impl Canvas,
    rx: f64,
    ry: f64,
    w: f64,
    h: f64,
    alpha: f64,
    state: &WaveState,
    theme: &Theme,
) {
    match theme.wave_style {
        WaveStyle::Classic => draw_waveform(cr, rx, ry, w, h, alpha, state, theme),
        WaveStyle::Ribbon => draw_waveform_ribbon(cr, rx, ry, w, h, alpha, state, theme),
        WaveStyle::Bars => draw_waveform_bars(cr, rx, ry, w, h, alpha, state, theme),
        WaveStyle::Pulse => draw_waveform_pulse(cr, rx, ry, w, h, alpha, state, theme),
        WaveStyle::Minimal => draw_waveform_minimal(cr, rx, ry, w, h, alpha, state, theme),
        WaveStyle::Dots => draw_waveform_dots(cr, rx, ry, w, h, alpha, state, theme),
        WaveStyle::Spectrum => draw_waveform_spectrum(cr, rx, ry, w, h, alpha, state, theme),
        WaveStyle::Orb => draw_waveform_orb(cr, rx, ry, w, h, alpha, state, theme),
        WaveStyle::Heartbeat => draw_waveform_heartbeat(cr, rx, ry, w, h, alpha, state, theme),
        WaveStyle::Particles => draw_waveform_particles(cr, rx, ry, w, h, alpha, state, theme),
        WaveStyle::Liquid => draw_waveform_liquid(cr, rx, ry, w, h, alpha, state, theme),
    }
}
struct WaveConfig {
    frequency: f64,
    multiplier: f64,
    phase_offset: f64,
    opacity: f64,
}

const WAVE_CONFIGS: &[WaveConfig] = &[
    WaveConfig {
        frequency: 0.8,
        multiplier: 1.6,
        phase_offset: 0.0,
        opacity: 1.0,
    },
    WaveConfig {
        frequency: 1.0,
        multiplier: 1.35,
        phase_offset: 0.85,
        opacity: 0.78,
    },
    WaveConfig {
        frequency: 1.25,
        multiplier: 1.05,
        phase_offset: 1.7,
        opacity: 0.56,
    },
];

fn trace_sine(
    cr: &impl Canvas,
    rx: f64,
    pill_w: f64,
    baseline: f64,
    amplitude: f64,
    frequency: f64,
    phase: f64,
) {
    let segments = (pill_w / 2.0).max(72.0) as i32;
    for i in 0..=segments {
        let t = i as f64 / segments as f64;
        let x = rx + pill_w * t;
        let y = baseline + amplitude * (frequency * t * TAU + phase).sin();
        if i == 0 {
            cr.move_to(x, y);
        } else {
            cr.line_to(x, y);
        }
    }
}

fn wave_level(state: &WaveState, theme: &Theme) -> f64 {
    (state.level * theme.intensity).min(1.0)
}

fn set_accent_source(cr: &impl Canvas, theme: &Theme, rx: f64, pill_w: f64, alpha: f64) {
    let alpha = alpha * theme.wave_opacity;
    let (r, g, b) = theme.accent;
    match theme.accent2 {
        Some((r2, g2, b2)) => {
            cr.linear_source(
                rx,
                rx + pill_w,
                &[(0.0, r, g, b, alpha), (1.0, r2, g2, b2, alpha)],
            );
        }
        None => cr.set_source_rgba(r, g, b, alpha),
    }
}

fn begin_wave_clip(cr: &impl Canvas, rx: f64, ry: f64, pill_w: f64, pill_h: f64) {
    cr.save();
    cr.rounded_rect(rx, ry, pill_w, pill_h, pill_h / 2.0);
    cr.clip();
    cr.round_lines();
}

fn draw_waveform(
    cr: &impl Canvas,
    rx: f64,
    ry: f64,
    pill_w: f64,
    pill_h: f64,
    expand_t: f64,
    state: &WaveState,
    theme: &Theme,
) {
    let wave_phase = state.phase;
    let level = wave_level(state, theme);
    let baseline = ry + pill_h / 2.0;

    begin_wave_clip(cr, rx, ry, pill_w, pill_h);
    for config in WAVE_CONFIGS {
        let amplitude_factor = (level * config.multiplier).clamp(MIN_AMPLITUDE, MAX_AMPLITUDE);
        let amplitude = (pill_h * 0.75 * amplitude_factor).max(1.0);
        set_accent_source(cr, theme, rx, pill_w, config.opacity * expand_t);
        cr.set_line_width(theme.stroke_width);
        trace_sine(
            cr,
            rx,
            pill_w,
            baseline,
            amplitude,
            config.frequency,
            wave_phase + config.phase_offset,
        );
        cr.stroke();
    }
    cr.restore();
}

fn draw_waveform_ribbon(
    cr: &impl Canvas,
    rx: f64,
    ry: f64,
    pill_w: f64,
    pill_h: f64,
    expand_t: f64,
    state: &WaveState,
    theme: &Theme,
) {
    let wave_phase = state.phase;
    let level = wave_level(state, theme);
    let baseline = ry + pill_h / 2.0;
    let amplitude = (pill_h * 0.7 * (level * 1.5).clamp(MIN_AMPLITUDE, MAX_AMPLITUDE)).max(1.0);

    begin_wave_clip(cr, rx, ry, pill_w, pill_h);
    trace_sine(cr, rx, pill_w, baseline, amplitude, 0.9, wave_phase);
    cr.line_to(rx + pill_w, ry + pill_h);
    cr.line_to(rx, ry + pill_h);
    cr.close_path();
    set_accent_source(cr, theme, rx, pill_w, 0.18 * expand_t);
    cr.fill();

    for (frequency, phase_offset, width, alpha) in [(0.9, 0.0, 3.0, 0.95), (1.1, 1.2, 2.0, 0.5)] {
        set_accent_source(cr, theme, rx, pill_w, alpha * expand_t);
        cr.set_line_width(width * theme.stroke_width / STROKE_WIDTH);
        trace_sine(
            cr,
            rx,
            pill_w,
            baseline,
            amplitude,
            frequency,
            wave_phase + phase_offset,
        );
        cr.stroke();
    }
    cr.restore();
}

fn draw_waveform_bars(
    cr: &impl Canvas,
    rx: f64,
    ry: f64,
    pill_w: f64,
    pill_h: f64,
    expand_t: f64,
    state: &WaveState,
    theme: &Theme,
) {
    let wave_phase = state.phase;
    let level = wave_level(state, theme);
    let bar_w = 3.0;
    let gap = 3.0;
    let count = ((pill_w - gap) / (bar_w + gap)).floor().max(3.0) as usize;
    let span = count as f64 * (bar_w + gap) - gap;
    let start_x = rx + (pill_w - span) / 2.0 + bar_w / 2.0;
    let center_y = ry + pill_h / 2.0;

    begin_wave_clip(cr, rx, ry, pill_w, pill_h);
    set_accent_source(cr, theme, rx, pill_w, 0.95 * expand_t);
    cr.set_line_width(bar_w);
    for i in 0..count {
        let ripple = 0.55 + 0.45 * (wave_phase * 2.0 + i as f64 * 0.7).sin();
        let height = (pill_h * 0.8 * (level * 1.4 * ripple).clamp(0.08, 1.0)).max(bar_w);
        let x = start_x + i as f64 * (bar_w + gap);
        cr.move_to(x, center_y - height / 2.0);
        cr.line_to(x, center_y + height / 2.0);
        cr.stroke();
    }
    cr.restore();
}

fn draw_waveform_pulse(
    cr: &impl Canvas,
    rx: f64,
    ry: f64,
    pill_w: f64,
    pill_h: f64,
    expand_t: f64,
    state: &WaveState,
    theme: &Theme,
) {
    let wave_phase = state.phase;
    let level = wave_level(state, theme);
    let cx = rx + pill_w / 2.0;
    let cy = ry + pill_h / 2.0;
    let max_radius = pill_w * 0.45;

    begin_wave_clip(cr, rx, ry, pill_w, pill_h);
    for i in 0..3 {
        let progress = (wave_phase / TAU + i as f64 / 3.0) % 1.0;
        let radius = pill_h * 0.2 + progress * max_radius;
        let alpha = (1.0 - progress) * (0.25 + 0.6 * level) * expand_t;
        set_accent_source(cr, theme, rx, pill_w, alpha);
        cr.set_line_width(1.5);
        cr.arc(cx, cy, radius, 0.0, TAU);
        cr.stroke();
    }
    set_accent_source(cr, theme, rx, pill_w, expand_t);
    cr.arc(cx, cy, 2.5 + level * (pill_h * 0.25), 0.0, TAU);
    cr.fill();
    cr.restore();
}

fn draw_waveform_minimal(
    cr: &impl Canvas,
    rx: f64,
    ry: f64,
    pill_w: f64,
    pill_h: f64,
    expand_t: f64,
    state: &WaveState,
    theme: &Theme,
) {
    let wave_phase = state.phase;
    let level = wave_level(state, theme);
    let baseline = ry + pill_h / 2.0;
    let amplitude = (pill_h * 0.45 * (level * 1.4).clamp(MIN_AMPLITUDE, MAX_AMPLITUDE)).max(0.8);

    begin_wave_clip(cr, rx, ry, pill_w, pill_h);
    set_accent_source(cr, theme, rx, pill_w, 0.9 * expand_t);
    cr.set_line_width(1.2 * theme.stroke_width / STROKE_WIDTH);
    trace_sine(cr, rx, pill_w, baseline, amplitude, 1.0, wave_phase);
    cr.stroke();
    cr.restore();
}

fn draw_waveform_dots(
    cr: &impl Canvas,
    rx: f64,
    ry: f64,
    pill_w: f64,
    pill_h: f64,
    expand_t: f64,
    state: &WaveState,
    theme: &Theme,
) {
    let wave_phase = state.phase;
    let level = wave_level(state, theme);
    let baseline = ry + pill_h / 2.0;
    let count = ((pill_w / 7.0).floor() as usize).max(5);
    let amplitude = (pill_h * 0.32 * (level * 1.5).clamp(0.08, 1.0)).max(0.5);

    begin_wave_clip(cr, rx, ry, pill_w, pill_h);
    for i in 0..count {
        let t = (i as f64 + 0.5) / count as f64;
        let x = rx + pill_w * t;
        let y = baseline + amplitude * (t * TAU * 1.3 + wave_phase).sin();
        let (r, g, b) = theme.accent_at(t);
        cr.set_source_rgba(
            r,
            g,
            b,
            (0.55 + 0.45 * (t * TAU + wave_phase * 0.5).sin().abs())
                * expand_t
                * theme.wave_opacity,
        );
        cr.arc(x, y, 1.6 + level * 1.4, 0.0, TAU);
        cr.fill();
    }
    cr.restore();
}

fn draw_waveform_spectrum(
    cr: &impl Canvas,
    rx: f64,
    ry: f64,
    pill_w: f64,
    pill_h: f64,
    expand_t: f64,
    state: &WaveState,
    theme: &Theme,
) {
    let wave_phase = state.phase;
    let level = wave_level(state, theme);
    let bar_w = 2.5;
    let gap = 2.0;
    let count = (((pill_w * 0.8) / (bar_w + gap)).floor() as usize).max(7);
    let span = count as f64 * (bar_w + gap) - gap;
    let start_x = rx + (pill_w - span) / 2.0 + bar_w / 2.0;
    let center_y = ry + pill_h / 2.0;

    begin_wave_clip(cr, rx, ry, pill_w, pill_h);
    cr.set_line_width(bar_w);
    for i in 0..count {
        let t = i as f64 / (count - 1).max(1) as f64;
        let envelope = 1.0 - (t - 0.5).abs() * 1.6;
        let band = 0.35 + 0.65 * (wave_phase * 1.7 + i as f64 * 1.1).sin().abs();
        let height = (pill_h * 0.85 * (level * 1.3 * band * envelope).clamp(0.05, 1.0)).max(bar_w);
        let x = start_x + i as f64 * (bar_w + gap);
        let (r, g, b) = theme.accent_at(t);
        cr.set_source_rgba(r, g, b, 0.95 * expand_t * theme.wave_opacity);
        cr.move_to(x, center_y - height / 2.0);
        cr.line_to(x, center_y + height / 2.0);
        cr.stroke();
    }
    cr.restore();
}

fn draw_waveform_orb(
    cr: &impl Canvas,
    rx: f64,
    ry: f64,
    pill_w: f64,
    pill_h: f64,
    expand_t: f64,
    state: &WaveState,
    theme: &Theme,
) {
    let wave_phase = state.phase;
    let level = wave_level(state, theme);
    let cx = rx + pill_w / 2.0;
    let cy = ry + pill_h / 2.0;
    let radius = pill_h * 0.22 + level * pill_h * 0.28 + (wave_phase * 2.0).sin() * pill_h * 0.03;
    let (r, g, b) = theme.accent;
    let (r2, g2, b2) = theme.accent_at(1.0);

    begin_wave_clip(cr, rx, ry, pill_w, pill_h);
    cr.radial_source(
        (cx, cy, radius * 0.3, cx, cy, radius * 2.4),
        &[(0.0, r2, g2, b2, 0.55 * expand_t), (1.0, r2, g2, b2, 0.0)],
    );
    cr.arc(cx, cy, radius * 2.4, 0.0, TAU);
    cr.fill();

    cr.radial_source(
        (cx - radius * 0.3, cy - radius * 0.3, 0.0, cx, cy, radius),
        &[
            (0.0, 1.0, 1.0, 1.0, 0.9 * expand_t),
            (0.4, r, g, b, expand_t),
            (1.0, r2, g2, b2, 0.85 * expand_t),
        ],
    );
    cr.arc(cx, cy, radius, 0.0, TAU);
    cr.fill();
    cr.restore();
}

fn ecg_shape(u: f64) -> f64 {
    let bump = |center: f64, width: f64, height: f64| {
        let d = (u - center) / width;
        if d.abs() < 1.0 {
            height * (1.0 - d * d)
        } else {
            0.0
        }
    };
    let spike_up = if (0.30..0.36).contains(&u) {
        (u - 0.30) / 0.06
    } else {
        0.0
    };
    let spike_down = if (0.36..0.44).contains(&u) {
        1.0 - (u - 0.36) / 0.08 * 1.35
    } else {
        0.0
    };
    bump(0.14, 0.05, 0.18) + spike_up + spike_down + bump(0.62, 0.07, 0.28)
}

fn draw_waveform_heartbeat(
    cr: &impl Canvas,
    rx: f64,
    ry: f64,
    pill_w: f64,
    pill_h: f64,
    expand_t: f64,
    state: &WaveState,
    theme: &Theme,
) {
    let wave_phase = state.phase;
    let level = wave_level(state, theme);
    let baseline = ry + pill_h * 0.6;
    let amplitude = pill_h * 0.42 * (0.35 + 0.65 * level.min(1.0));
    let scroll = wave_phase / TAU;

    begin_wave_clip(cr, rx, ry, pill_w, pill_h);
    set_accent_source(cr, theme, rx, pill_w, 0.95 * expand_t);
    cr.set_line_width(theme.stroke_width);
    let segments = (pill_w * 1.5) as i32;
    for i in 0..=segments {
        let t = i as f64 / segments as f64;
        let u = (t * 1.6 + scroll).rem_euclid(1.0);
        let y = baseline - amplitude * ecg_shape(u);
        let x = rx + pill_w * t;
        if i == 0 {
            cr.move_to(x, y);
        } else {
            cr.line_to(x, y);
        }
    }
    cr.stroke();
    cr.restore();
}

fn draw_waveform_particles(
    cr: &impl Canvas,
    rx: f64,
    ry: f64,
    pill_w: f64,
    pill_h: f64,
    expand_t: f64,
    state: &WaveState,
    theme: &Theme,
) {
    let wave_phase = state.phase;
    let level = wave_level(state, theme);
    let time = state.clock * (0.6 + level * 1.4);
    let count = 22;

    begin_wave_clip(cr, rx, ry, pill_w, pill_h);
    for i in 0..count {
        let seed = (i as f64 * 0.618_033_9).fract();
        let seed2 = (i as f64 * std::f64::consts::FRAC_1_PI).fract();
        let x = rx + pill_w * (seed + time * (0.05 + seed2 * 0.08)).fract();
        let rise = (time * (0.4 + seed * 0.6) + seed2).fract();
        let y = ry + pill_h * (0.9 - rise * 0.8);
        let alpha = (1.0 - (rise - 0.5).abs() * 2.0).max(0.0)
            * (0.35 + 0.65 * level)
            * expand_t
            * theme.wave_opacity;
        let (r, g, b) = theme.accent_at(seed);
        cr.set_source_rgba(r, g, b, alpha);
        cr.arc(
            x,
            y,
            1.0 + seed2 * 2.0 + level * 1.2 + 0.4 * (wave_phase + i as f64).sin(),
            0.0,
            TAU,
        );
        cr.fill();
    }
    cr.restore();
}

fn draw_waveform_liquid(
    cr: &impl Canvas,
    rx: f64,
    ry: f64,
    pill_w: f64,
    pill_h: f64,
    expand_t: f64,
    state: &WaveState,
    theme: &Theme,
) {
    let wave_phase = state.phase;
    let level = wave_level(state, theme);
    let surface = ry + pill_h * (0.8 - 0.55 * level.min(1.0));
    let amplitude = (pill_h * 0.12 * (0.4 + level)).max(0.8);

    begin_wave_clip(cr, rx, ry, pill_w, pill_h);
    let segments = (pill_w / 2.0).max(60.0) as i32;
    let trace = || {
        for i in 0..=segments {
            let t = i as f64 / segments as f64;
            let x = rx + pill_w * t;
            let y = surface
                + amplitude
                    * ((t * TAU * 1.4 + wave_phase).sin() * 0.7
                        + (t * TAU * 2.3 - wave_phase * 1.3).sin() * 0.3);
            if i == 0 {
                cr.move_to(x, y);
            } else {
                cr.line_to(x, y);
            }
        }
    };
    trace();
    cr.line_to(rx + pill_w, ry + pill_h);
    cr.line_to(rx, ry + pill_h);
    cr.close_path();
    set_accent_source(cr, theme, rx, pill_w, 0.55 * expand_t);
    cr.fill();
    trace();
    set_accent_source(cr, theme, rx, pill_w, 0.95 * expand_t);
    cr.set_line_width(theme.stroke_width);
    cr.stroke();
    cr.restore();
}
