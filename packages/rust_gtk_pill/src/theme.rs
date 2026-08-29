use crate::constants::{MAX_THEME_SCALE, MIN_THEME_SCALE};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum WaveStyle {
    Classic,
    Ribbon,
    Bars,
    Pulse,
    Minimal,
    Dots,
    Spectrum,
    Orb,
}

impl WaveStyle {
    fn parse(value: &str) -> Self {
        match value {
            "ribbon" => Self::Ribbon,
            "bars" => Self::Bars,
            "pulse" => Self::Pulse,
            "minimal" => Self::Minimal,
            "dots" => Self::Dots,
            "spectrum" => Self::Spectrum,
            "orb" => Self::Orb,
            _ => Self::Classic,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub(crate) enum Position {
    Left,
    #[default]
    Center,
    Right,
}

impl Position {
    fn parse(value: &str) -> Self {
        match value {
            "left" => Self::Left,
            "right" => Self::Right,
            _ => Self::Center,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub(crate) enum LoadingStyle {
    #[default]
    Bar,
    Spinner,
    Dots,
}

impl LoadingStyle {
    fn parse(value: &str) -> Self {
        match value {
            "spinner" => Self::Spinner,
            "dots" => Self::Dots,
            _ => Self::Bar,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub(crate) struct Placement {
    pub(crate) position: Position,
    pub(crate) bottom_offset: f64,
    pub(crate) pill_width: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CompletionEffect {
    None,
    Sparkle,
    Fireworks,
}

impl CompletionEffect {
    fn parse(value: &str) -> Self {
        match value {
            "sparkle" => Self::Sparkle,
            "fireworks" => Self::Fireworks,
            _ => Self::None,
        }
    }
}

#[derive(Debug, Clone)]
pub(crate) struct Theme {
    pub(crate) wave_style: WaveStyle,
    pub(crate) accent: (f64, f64, f64),
    pub(crate) accent2: Option<(f64, f64, f64)>,
    pub(crate) background: (f64, f64, f64),
    pub(crate) background_alpha: f64,
    pub(crate) border_width: f64,
    pub(crate) roundness: f64,
    pub(crate) speed: f64,
    pub(crate) intensity: f64,
    pub(crate) glow: bool,
    pub(crate) scale: f64,
    pub(crate) effect: CompletionEffect,
    pub(crate) position: Position,
    pub(crate) bottom_offset: f64,
    pub(crate) idle_opacity: f64,
    pub(crate) idle_width: f64,
    pub(crate) idle_label: String,
    pub(crate) show_timer: bool,
    pub(crate) reactive_glow: bool,
    pub(crate) loading_style: LoadingStyle,
    pub(crate) shadow: bool,
    pub(crate) rainbow: bool,
    pub(crate) border_color: Option<(f64, f64, f64)>,
}

pub(crate) struct ThemeMessage<'a> {
    pub(crate) wave_style: &'a str,
    pub(crate) accent_color: &'a str,
    pub(crate) accent_color_2: &'a str,
    pub(crate) background_color: &'a str,
    pub(crate) background_alpha: f64,
    pub(crate) border_width: f64,
    pub(crate) roundness: f64,
    pub(crate) speed: f64,
    pub(crate) intensity: f64,
    pub(crate) glow: bool,
    pub(crate) scale: f64,
    pub(crate) effect: &'a str,
    pub(crate) position: &'a str,
    pub(crate) bottom_offset: f64,
    pub(crate) idle_opacity: f64,
    pub(crate) idle_width: f64,
    pub(crate) idle_label: &'a str,
    pub(crate) show_timer: bool,
    pub(crate) reactive_glow: bool,
    pub(crate) loading_style: &'a str,
    pub(crate) shadow: bool,
    pub(crate) rainbow: bool,
    pub(crate) border_color: &'a str,
}

impl Default for Theme {
    fn default() -> Self {
        Self {
            wave_style: WaveStyle::Classic,
            accent: (1.0, 1.0, 1.0),
            accent2: None,
            background: (0.0, 0.0, 0.0),
            background_alpha: 1.0,
            border_width: 1.0,
            roundness: 1.0,
            speed: 1.0,
            intensity: 1.0,
            glow: false,
            scale: 1.0,
            effect: CompletionEffect::None,
            position: Position::Center,
            bottom_offset: 0.0,
            idle_opacity: 1.0,
            idle_width: 1.0,
            idle_label: String::new(),
            show_timer: false,
            reactive_glow: false,
            loading_style: LoadingStyle::Bar,
            shadow: false,
            rainbow: false,
            border_color: None,
        }
    }
}

impl Theme {
    pub(crate) fn from_message(message: ThemeMessage<'_>) -> Self {
        let clamp = |value: f64, min: f64, max: f64, fallback: f64| {
            if value.is_finite() {
                value.clamp(min, max)
            } else {
                fallback
            }
        };
        Self {
            wave_style: WaveStyle::parse(message.wave_style),
            accent: parse_hex_color(message.accent_color).unwrap_or((1.0, 1.0, 1.0)),
            accent2: parse_hex_color(message.accent_color_2),
            background: parse_hex_color(message.background_color).unwrap_or((0.0, 0.0, 0.0)),
            background_alpha: clamp(message.background_alpha, 0.2, 1.0, 1.0),
            border_width: clamp(message.border_width, 0.0, 4.0, 1.0),
            roundness: clamp(message.roundness, 0.0, 1.0, 1.0),
            speed: clamp(message.speed, 0.4, 2.5, 1.0),
            intensity: clamp(message.intensity, 0.4, 2.5, 1.0),
            glow: message.glow,
            scale: clamp(message.scale, MIN_THEME_SCALE, MAX_THEME_SCALE, 1.0),
            effect: CompletionEffect::parse(message.effect),
            position: Position::parse(message.position),
            bottom_offset: clamp(message.bottom_offset, 0.0, 300.0, 0.0),
            idle_opacity: clamp(message.idle_opacity, 0.1, 1.0, 1.0),
            idle_width: clamp(message.idle_width, 0.5, 2.5, 1.0),
            idle_label: message.idle_label.trim().chars().take(40).collect(),
            show_timer: message.show_timer,
            reactive_glow: message.reactive_glow,
            loading_style: LoadingStyle::parse(message.loading_style),
            shadow: message.shadow,
            rainbow: message.rainbow,
            border_color: parse_hex_color(message.border_color),
        }
    }

    pub(crate) fn placement(&self) -> Placement {
        Placement {
            position: self.position,
            bottom_offset: self.bottom_offset,
            pill_width: crate::constants::EXPANDED_PILL_WIDTH * self.scale,
        }
    }

    pub(crate) fn accent_at(&self, t: f64) -> (f64, f64, f64) {
        match self.accent2 {
            Some((r2, g2, b2)) => {
                let (r, g, b) = self.accent;
                (r + (r2 - r) * t, g + (g2 - g) * t, b + (b2 - b) * t)
            }
            None => self.accent,
        }
    }
}

pub(crate) fn hue_to_rgb(hue: f64) -> (f64, f64, f64) {
    let h = (hue.rem_euclid(1.0)) * 6.0;
    let x = 1.0 - ((h % 2.0) - 1.0).abs();
    let (r, g, b) = match h as u32 {
        0 => (1.0, x, 0.0),
        1 => (x, 1.0, 0.0),
        2 => (0.0, 1.0, x),
        3 => (0.0, x, 1.0),
        4 => (x, 0.0, 1.0),
        _ => (1.0, 0.0, x),
    };
    let soften = |c: f64| 0.25 + 0.75 * c;
    (soften(r), soften(g), soften(b))
}

pub(crate) fn parse_hex_color(value: &str) -> Option<(f64, f64, f64)> {
    let hex = value.trim().trim_start_matches('#');
    let expanded: String = match hex.len() {
        3 => hex.chars().flat_map(|c| [c, c]).collect(),
        6 => hex.to_string(),
        _ => return None,
    };
    let channel = |index: usize| {
        u8::from_str_radix(&expanded[index..index + 2], 16)
            .ok()
            .map(|v| v as f64 / 255.0)
    };
    Some((channel(0)?, channel(2)?, channel(4)?))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_hex_colors() {
        assert_eq!(parse_hex_color("#FF0000"), Some((1.0, 0.0, 0.0)));
        assert_eq!(parse_hex_color("0f0"), Some((0.0, 1.0, 0.0)));
        assert_eq!(parse_hex_color("nope"), None);
    }

    #[test]
    fn clamps_scale_and_falls_back_on_bad_input() {
        let theme = Theme::from_message(ThemeMessage {
            wave_style: "bars",
            accent_color: "zzz",
            accent_color_2: "#00FF00",
            background_color: "",
            background_alpha: f64::NAN,
            border_width: 99.0,
            roundness: -1.0,
            speed: 1.2,
            intensity: 1.0,
            glow: true,
            scale: 9.0,
            effect: "sparkle",
            position: "right",
            bottom_offset: 40.0,
            idle_opacity: 0.5,
            idle_width: 1.5,
            idle_label: "  Speak  ",
            show_timer: true,
            reactive_glow: true,
            loading_style: "spinner",
            shadow: true,
            rainbow: false,
            border_color: "#112233",
        });
        assert_eq!(theme.position, Position::Right);
        assert_eq!(theme.idle_label, "Speak");
        assert_eq!(theme.loading_style, LoadingStyle::Spinner);
        assert!(theme.border_color.is_some());
        assert_eq!(theme.wave_style, WaveStyle::Bars);
        assert_eq!(theme.accent, (1.0, 1.0, 1.0));
        assert_eq!(theme.accent2, Some((0.0, 1.0, 0.0)));
        assert_eq!(theme.background_alpha, 1.0);
        assert_eq!(theme.border_width, 4.0);
        assert_eq!(theme.roundness, 0.0);
        assert_eq!(theme.scale, MAX_THEME_SCALE);
        assert_eq!(theme.effect, CompletionEffect::Sparkle);
        assert_eq!(theme.accent_at(0.5), (0.5, 1.0, 0.5));
    }
}
