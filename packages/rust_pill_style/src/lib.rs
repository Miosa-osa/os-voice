pub mod waves;
pub const MIN_THEME_SCALE: f64 = 0.75;
pub const MAX_THEME_SCALE: f64 = 1.5;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WaveStyle {
    Classic,
    Ribbon,
    Bars,
    Pulse,
    Minimal,
    Dots,
    Spectrum,
    Orb,
    Heartbeat,
    Particles,
    Liquid,
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
            "heartbeat" => Self::Heartbeat,
            "particles" => Self::Particles,
            "liquid" => Self::Liquid,
            _ => Self::Classic,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Position {
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
pub enum LoadingStyle {
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum IdleShape {
    #[default]
    Bar,
    Dot,
}

impl IdleShape {
    fn parse(value: &str) -> Self {
        if value == "dot" {
            Self::Dot
        } else {
            Self::Bar
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct Placement {
    pub position: Position,
    pub bottom_offset: f64,
    pub pill_width: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CompletionEffect {
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
pub struct Theme {
    pub wave_style: WaveStyle,
    pub accent: (f64, f64, f64),
    pub accent2: Option<(f64, f64, f64)>,
    pub background: (f64, f64, f64),
    pub background_alpha: f64,
    pub border_width: f64,
    pub roundness: f64,
    pub speed: f64,
    pub intensity: f64,
    pub glow: bool,
    pub scale: f64,
    pub effect: CompletionEffect,
    pub position: Position,
    pub bottom_offset: f64,
    pub idle_opacity: f64,
    pub idle_width: f64,
    pub idle_label: String,
    pub show_timer: bool,
    pub reactive_glow: bool,
    pub loading_style: LoadingStyle,
    pub shadow: bool,
    pub rainbow: bool,
    pub border_color: Option<(f64, f64, f64)>,
    pub rec_indicator: bool,
    pub idle_shape: IdleShape,
    pub stroke_width: f64,
    pub wave_opacity: f64,
}

pub struct ThemeMessage<'a> {
    pub wave_style: &'a str,
    pub accent_color: &'a str,
    pub accent_color_2: &'a str,
    pub background_color: &'a str,
    pub background_alpha: f64,
    pub border_width: f64,
    pub roundness: f64,
    pub speed: f64,
    pub intensity: f64,
    pub glow: bool,
    pub scale: f64,
    pub effect: &'a str,
    pub position: &'a str,
    pub bottom_offset: f64,
    pub idle_opacity: f64,
    pub idle_width: f64,
    pub idle_label: &'a str,
    pub show_timer: bool,
    pub reactive_glow: bool,
    pub loading_style: &'a str,
    pub shadow: bool,
    pub rainbow: bool,
    pub border_color: &'a str,
    pub rec_indicator: bool,
    pub idle_shape: &'a str,
    pub stroke_width: f64,
    pub wave_opacity: f64,
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
            rec_indicator: false,
            idle_shape: IdleShape::Bar,
            stroke_width: 1.6,
            wave_opacity: 1.0,
        }
    }
}

impl Theme {
    pub fn from_message(message: ThemeMessage<'_>) -> Self {
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
            rec_indicator: message.rec_indicator,
            idle_shape: IdleShape::parse(message.idle_shape),
            stroke_width: clamp(message.stroke_width, 0.5, 4.0, 1.6),
            wave_opacity: clamp(message.wave_opacity, 0.2, 1.0, 1.0),
        }
    }

    pub fn placement(&self) -> Placement {
        Placement {
            position: self.position,
            bottom_offset: self.bottom_offset,
            pill_width: 120.0 * self.scale,
        }
    }

    pub fn accent_at(&self, t: f64) -> (f64, f64, f64) {
        match self.accent2 {
            Some((r2, g2, b2)) => {
                let (r, g, b) = self.accent;
                (r + (r2 - r) * t, g + (g2 - g) * t, b + (b2 - b) * t)
            }
            None => self.accent,
        }
    }
}

pub fn hue_to_rgb(hue: f64) -> (f64, f64, f64) {
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

pub fn parse_hex_color(value: &str) -> Option<(f64, f64, f64)> {
    let hex = value.trim().trim_start_matches('#');
    if !hex.is_ascii() {
        return None;
    }
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
        assert_eq!(parse_hex_color("你你"), None);
        assert_eq!(parse_hex_color("ééé"), None);
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
            rec_indicator: true,
            idle_shape: "dot",
            stroke_width: 9.0,
            wave_opacity: 0.5,
        });
        assert_eq!(theme.idle_shape, IdleShape::Dot);
        assert_eq!(theme.stroke_width, 4.0);
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

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct ThemeInput {
    pub wave_style: String,
    pub accent_color: String,
    pub accent_color_2: Option<String>,
    pub background_color: String,
    pub background_alpha: f64,
    pub border_width: f64,
    pub roundness: f64,
    pub speed: f64,
    pub intensity: f64,
    pub glow: bool,
    pub scale: f64,
    pub effect: String,
    pub position: String,
    pub bottom_offset: f64,
    pub idle_opacity: f64,
    pub idle_width: f64,
    pub idle_label: String,
    pub show_timer: bool,
    pub reactive_glow: bool,
    pub loading_style: String,
    pub shadow: bool,
    pub rainbow: bool,
    pub border_color: Option<String>,
    pub rec_indicator: bool,
    pub idle_shape: String,
    pub stroke_width: f64,
    pub wave_opacity: f64,
}
impl Default for ThemeInput {
    fn default() -> Self {
        Self {
            wave_style: "classic".into(),
            accent_color: "#ffffff".into(),
            accent_color_2: None,
            background_color: "#000000".into(),
            background_alpha: 1.0,
            border_width: 1.0,
            roundness: 1.0,
            speed: 1.0,
            intensity: 1.0,
            glow: false,
            scale: 1.0,
            effect: "none".into(),
            position: "center".into(),
            bottom_offset: 0.0,
            idle_opacity: 1.0,
            idle_width: 1.0,
            idle_label: String::new(),
            show_timer: false,
            reactive_glow: false,
            loading_style: "bar".into(),
            shadow: false,
            rainbow: false,
            border_color: None,
            rec_indicator: false,
            idle_shape: "bar".into(),
            stroke_width: 1.6,
            wave_opacity: 1.0,
        }
    }
}
impl ThemeInput {
    pub fn theme(&self) -> Theme {
        Theme::from_message(ThemeMessage {
            wave_style: &self.wave_style,
            accent_color: &self.accent_color,
            accent_color_2: self.accent_color_2.as_deref().unwrap_or(""),
            background_color: &self.background_color,
            background_alpha: self.background_alpha,
            border_width: self.border_width,
            roundness: self.roundness,
            speed: self.speed,
            intensity: self.intensity,
            glow: self.glow,
            scale: self.scale,
            effect: &self.effect,
            position: &self.position,
            bottom_offset: self.bottom_offset,
            idle_opacity: self.idle_opacity,
            idle_width: self.idle_width,
            idle_label: &self.idle_label,
            show_timer: self.show_timer,
            reactive_glow: self.reactive_glow,
            loading_style: &self.loading_style,
            shadow: self.shadow,
            rainbow: self.rainbow,
            border_color: self.border_color.as_deref().unwrap_or(""),
            rec_indicator: self.rec_indicator,
            idle_shape: &self.idle_shape,
            stroke_width: self.stroke_width,
            wave_opacity: self.wave_opacity,
        })
    }
}
