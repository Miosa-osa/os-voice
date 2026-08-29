use crate::constants::{MAX_THEME_SCALE, MIN_THEME_SCALE};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum WaveStyle {
    Classic,
    Ribbon,
    Bars,
    Pulse,
    Minimal,
}

impl WaveStyle {
    fn parse(value: &str) -> Self {
        match value {
            "ribbon" => Self::Ribbon,
            "bars" => Self::Bars,
            "pulse" => Self::Pulse,
            "minimal" => Self::Minimal,
            _ => Self::Classic,
        }
    }
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
    pub(crate) glow: bool,
    pub(crate) scale: f64,
    pub(crate) effect: CompletionEffect,
}

impl Default for Theme {
    fn default() -> Self {
        Self {
            wave_style: WaveStyle::Classic,
            accent: (1.0, 1.0, 1.0),
            glow: false,
            scale: 1.0,
            effect: CompletionEffect::None,
        }
    }
}

impl Theme {
    pub(crate) fn from_message(
        wave_style: &str,
        accent_color: &str,
        glow: bool,
        scale: f64,
        effect: &str,
    ) -> Self {
        Self {
            wave_style: WaveStyle::parse(wave_style),
            accent: parse_hex_color(accent_color).unwrap_or((1.0, 1.0, 1.0)),
            glow,
            scale: if scale.is_finite() {
                scale.clamp(MIN_THEME_SCALE, MAX_THEME_SCALE)
            } else {
                1.0
            },
            effect: CompletionEffect::parse(effect),
        }
    }
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
        let theme = Theme::from_message("bars", "zzz", true, 9.0, "sparkle");
        assert_eq!(theme.wave_style, WaveStyle::Bars);
        assert_eq!(theme.accent, (1.0, 1.0, 1.0));
        assert_eq!(theme.scale, MAX_THEME_SCALE);
        assert_eq!(theme.effect, CompletionEffect::Sparkle);
    }
}
