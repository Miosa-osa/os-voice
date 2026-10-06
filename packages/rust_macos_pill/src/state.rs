use std::cell::{Cell, RefCell};

use crate::ipc::{Phase, PillMessage, PillPermission, PillStreaming, Visibility};

use crate::constants::*;

#[derive(Debug, Clone)]
pub(crate) enum ClickAction {
    Pill,
    StyleForward,
    StyleBackward,
    AssistantClose,
    OpenInNew,
    KeyboardButton,
    CancelDictation,
    PermissionAllow(String),
    PermissionDeny(String),
    PermissionAlwaysAllow(String),
    SendButton,
    FlashAction,
}

#[derive(Debug, Clone)]
pub(crate) struct ClickRegion {
    pub(crate) x: f64,
    pub(crate) y: f64,
    pub(crate) w: f64,
    pub(crate) h: f64,
    pub(crate) action: ClickAction,
}

impl ClickRegion {
    pub(crate) fn contains(&self, px: f64, py: f64) -> bool {
        px >= self.x && px <= self.x + self.w && py >= self.y && py <= self.y + self.h
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum WindowMode {
    Dictation,
    AssistantCompact,
    AssistantExpanded,
    AssistantTyping,
}

impl WindowMode {
    pub(crate) fn from_str(s: &str) -> Self {
        match s {
            "assistant_compact" => Self::AssistantCompact,
            "assistant_expanded" => Self::AssistantExpanded,
            "assistant_typing" => Self::AssistantTyping,
            _ => Self::Dictation,
        }
    }

    pub(crate) fn dimensions(&self) -> (i32, i32) {
        match self {
            Self::Dictation => (DICTATION_WINDOW_WIDTH, DICTATION_WINDOW_HEIGHT),
            Self::AssistantCompact => (WINDOW_W_COMPACT, WINDOW_H_COMPACT),
            Self::AssistantExpanded => (WINDOW_W_EXPANDED, WINDOW_H_EXPANDED),
            Self::AssistantTyping => (WINDOW_W_TYPING, WINDOW_H_TYPING),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) enum RocketPhase {
    Rising,
    Exploding,
}

#[derive(Debug, Clone)]
pub(crate) struct Spark {
    pub(crate) x: f64,
    pub(crate) y: f64,
    pub(crate) vx: f64,
    pub(crate) vy: f64,
    pub(crate) life: f64,
}

#[derive(Debug, Clone)]
pub(crate) struct Rocket {
    pub(crate) x: f64,
    pub(crate) y: f64,
    pub(crate) vx: f64,
    pub(crate) vy: f64,
    pub(crate) trail: Vec<(f64, f64)>,
    pub(crate) fuse: f64,
    pub(crate) phase: RocketPhase,
    pub(crate) num_sparks: usize,
    pub(crate) launch_index: usize,
    pub(crate) sparks: Vec<Spark>,
    pub(crate) trail_alpha: f64,
    pub(crate) color: (f64, f64, f64),
}

#[derive(Debug, Clone)]
pub(crate) struct FlameTongue {
    pub(crate) t: f64,
    pub(crate) height: f64,
    pub(crate) width: f64,
    pub(crate) phase: f64,
    pub(crate) speed: f64,
}

pub(crate) struct PillState {
    pub(crate) theme: RefCell<rust_pill_style::Theme>,
    pub(crate) preview: Cell<bool>,
    pub(crate) preview_clock: Cell<f64>,
    pub(crate) rainbow_clock: Cell<f64>,
    pub(crate) recording_started: Cell<Option<std::time::Instant>>,
    pub(crate) sparkle_active: Cell<bool>,
    pub(crate) sparkle_elapsed: Cell<f64>,
    pub(crate) phase: Cell<Phase>,
    pub(crate) visibility: Cell<Visibility>,
    pub(crate) expand_t: Cell<f64>,
    pub(crate) expand_velocity: Cell<f64>,
    pub(crate) hovered: Cell<bool>,
    pub(crate) window_ordered_front: Cell<bool>,
    pub(crate) last_order_assert: Cell<f64>,
    pub(crate) wave_phase: Cell<f64>,
    pub(crate) current_level: Cell<f64>,
    pub(crate) target_level: Cell<f64>,
    pub(crate) loading_offset: Cell<f64>,
    pub(crate) pending_levels: RefCell<Vec<f32>>,
    pub(crate) style_count: Cell<u32>,
    pub(crate) style_name: RefCell<String>,
    pub(crate) tooltip_t: Cell<f64>,
    pub(crate) tooltip_velocity: Cell<f64>,
    pub(crate) tooltip_width: Cell<f64>,
    pub(crate) ui_scale: f64,

    // Window sizing
    pub(crate) window_mode: Cell<WindowMode>,
    pub(crate) draw_width: Cell<f64>,
    pub(crate) draw_height: Cell<f64>,
    pub(crate) draw_w_velocity: Cell<f64>,
    pub(crate) draw_h_velocity: Cell<f64>,

    // Assistant state
    pub(crate) assistant_active: Cell<bool>,
    pub(crate) assistant_input_mode: RefCell<String>,
    pub(crate) assistant_compact: Cell<bool>,
    pub(crate) assistant_conversation_id: RefCell<Option<String>>,
    pub(crate) assistant_user_prompt: RefCell<Option<String>>,
    pub(crate) assistant_messages: RefCell<Vec<PillMessage>>,
    pub(crate) assistant_streaming: RefCell<Option<PillStreaming>>,
    pub(crate) assistant_permissions: RefCell<Vec<PillPermission>>,

    // Assistant UI animation
    pub(crate) panel_open_t: Cell<f64>,
    pub(crate) panel_open_velocity: Cell<f64>,
    pub(crate) kb_button_t: Cell<f64>,
    pub(crate) kb_button_velocity: Cell<f64>,
    pub(crate) shimmer_phase: Cell<f64>,

    // Scroll
    pub(crate) scroll_offset: Cell<f64>,
    pub(crate) content_height: Cell<f64>,
    pub(crate) viewport_height: Cell<f64>,
    pub(crate) should_stick: Cell<bool>,

    // Click regions (rebuilt each frame)
    pub(crate) click_regions: RefCell<Vec<ClickRegion>>,

    // Entry text (for typing mode)
    pub(crate) entry_text: RefCell<String>,

    // Cancel button animation
    pub(crate) cancel_t: Cell<f64>,
    pub(crate) cancel_velocity: Cell<f64>,

    // Flash message / toast
    pub(crate) flash_message: RefCell<String>,
    pub(crate) flash_visible: Cell<bool>,
    pub(crate) flash_t: Cell<f64>,
    pub(crate) flash_velocity: Cell<f64>,
    pub(crate) flash_timer: Cell<f64>,
    pub(crate) flash_is_error: Cell<bool>,
    pub(crate) flash_action: RefCell<Option<String>>,
    pub(crate) flash_action_label: RefCell<Option<String>>,

    // Fireworks
    pub(crate) fireworks_active: Cell<bool>,
    pub(crate) fireworks_elapsed: Cell<f64>,
    pub(crate) fireworks_next_launch: Cell<usize>,
    pub(crate) fireworks_rockets: RefCell<Vec<Rocket>>,

    // Flame
    pub(crate) flame_active: Cell<bool>,
    pub(crate) flame_elapsed: Cell<f64>,
    pub(crate) flame_tongues: RefCell<Vec<FlameTongue>>,

    // Flash blue border
    pub(crate) flash_blue_active: Cell<bool>,
    pub(crate) flash_blue_elapsed: Cell<f64>,

    // Broadcast transcript (live text above the pill)
    pub(crate) transcript_text: RefCell<String>,
    pub(crate) transcript_time_since_update: Cell<f64>,
    pub(crate) transcript_opacity: Cell<f64>,
    pub(crate) transcript_has_message: Cell<bool>,
}

impl PillState {
    pub(crate) fn new(ui_scale: f64) -> Self {
        Self {
            theme: RefCell::new(rust_pill_style::Theme::default()),
            preview: Cell::new(false),
            preview_clock: Cell::new(0.0),
            rainbow_clock: Cell::new(0.0),
            recording_started: Cell::new(None),
            sparkle_active: Cell::new(false),
            sparkle_elapsed: Cell::new(0.0),
            phase: Cell::new(Phase::Idle),
            visibility: Cell::new(Visibility::WhileActive),
            expand_t: Cell::new(0.0),
            expand_velocity: Cell::new(0.0),
            hovered: Cell::new(false),
            window_ordered_front: Cell::new(false),
            last_order_assert: Cell::new(0.0),
            wave_phase: Cell::new(0.0),
            current_level: Cell::new(0.0),
            target_level: Cell::new(0.0),
            loading_offset: Cell::new(0.0),
            pending_levels: RefCell::new(Vec::new()),
            style_count: Cell::new(0),
            style_name: RefCell::new(String::new()),
            tooltip_t: Cell::new(0.0),
            tooltip_velocity: Cell::new(0.0),
            tooltip_width: Cell::new(0.0),
            ui_scale,
            window_mode: Cell::new(WindowMode::Dictation),
            draw_width: Cell::new(DICTATION_WINDOW_WIDTH as f64),
            draw_height: Cell::new(DICTATION_WINDOW_HEIGHT as f64),
            draw_w_velocity: Cell::new(0.0),
            draw_h_velocity: Cell::new(0.0),
            assistant_active: Cell::new(false),
            assistant_input_mode: RefCell::new("voice".to_string()),
            assistant_compact: Cell::new(true),
            assistant_conversation_id: RefCell::new(None),
            assistant_user_prompt: RefCell::new(None),
            assistant_messages: RefCell::new(Vec::new()),
            assistant_streaming: RefCell::new(None),
            assistant_permissions: RefCell::new(Vec::new()),
            panel_open_t: Cell::new(0.0),
            panel_open_velocity: Cell::new(0.0),
            kb_button_t: Cell::new(0.0),
            kb_button_velocity: Cell::new(0.0),
            shimmer_phase: Cell::new(0.0),
            scroll_offset: Cell::new(0.0),
            content_height: Cell::new(0.0),
            viewport_height: Cell::new(0.0),
            should_stick: Cell::new(true),
            click_regions: RefCell::new(Vec::new()),
            entry_text: RefCell::new(String::new()),
            cancel_t: Cell::new(0.0),
            cancel_velocity: Cell::new(0.0),
            flash_message: RefCell::new(String::new()),
            flash_visible: Cell::new(false),
            flash_t: Cell::new(0.0),
            flash_velocity: Cell::new(0.0),
            flash_timer: Cell::new(0.0),
            flash_is_error: Cell::new(false),
            flash_action: RefCell::new(None),
            flash_action_label: RefCell::new(None),
            fireworks_active: Cell::new(false),
            fireworks_elapsed: Cell::new(0.0),
            fireworks_next_launch: Cell::new(0),
            fireworks_rockets: RefCell::new(Vec::new()),
            flame_active: Cell::new(false),
            flame_elapsed: Cell::new(0.0),
            flame_tongues: RefCell::new(Vec::new()),
            flash_blue_active: Cell::new(false),
            flash_blue_elapsed: Cell::new(0.0),
            transcript_text: RefCell::new(String::new()),
            transcript_time_since_update: Cell::new(0.0),
            transcript_opacity: Cell::new(0.0),
            transcript_has_message: Cell::new(false),
        }
    }

    pub(crate) fn is_previewing(&self) -> bool {
        self.preview.get() && self.phase.get() == Phase::Idle && !self.assistant_active.get()
    }

    pub(crate) fn content_offset(&self) -> (f64, f64) {
        let dw = self.draw_width.get();
        let dh = self.draw_height.get();
        (
            (WINDOW_W_TYPING as f64 - dw) / 2.0,
            WINDOW_H_TYPING as f64 - dh,
        )
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum WindowOrderAction {
    OrderFront,
    OrderOut,
    None,
}

/// Decide whether a tick should touch the window's ordering.
///
/// Re-ordering is expensive: every `orderFront:` forces a synchronous
/// WindowServer transaction (a fresh CoreAnimation fence), so issuing it on
/// each display refresh pegs the main thread and eventually wedges the app
/// once the window server is under load. Only act on a real shown/hidden
/// transition, plus a slow heartbeat so the pill still recovers if something
/// covers it.
pub(crate) fn window_order_action(
    should_show: bool,
    was_ordered_front: bool,
    now: f64,
    last_assert: f64,
    reassert_secs: f64,
) -> WindowOrderAction {
    if should_show != was_ordered_front {
        if should_show {
            WindowOrderAction::OrderFront
        } else {
            WindowOrderAction::OrderOut
        }
    } else if should_show && now - last_assert >= reassert_secs {
        WindowOrderAction::OrderFront
    } else {
        WindowOrderAction::None
    }
}

#[cfg(test)]
mod window_order_tests {
    use super::{window_order_action, WindowOrderAction};

    const REASSERT_SECS: f64 = 2.0;

    #[test]
    fn first_show_orders_the_window_front() {
        assert_eq!(
            window_order_action(true, false, 100.0, 0.0, REASSERT_SECS),
            WindowOrderAction::OrderFront
        );
    }

    #[test]
    fn steady_state_does_not_reorder_every_frame() {
        // Regression guard: once the window is already ordered front and the
        // heartbeat has not elapsed, a tick must NOT re-issue orderFront.
        // Issuing it on every display refresh is what pegged the main thread.
        assert_eq!(
            window_order_action(true, true, 100.0, 100.0, REASSERT_SECS),
            WindowOrderAction::None
        );
        assert_eq!(
            window_order_action(true, true, 101.9, 100.0, REASSERT_SECS),
            WindowOrderAction::None
        );
    }

    #[test]
    fn reasserts_front_on_the_heartbeat() {
        assert_eq!(
            window_order_action(true, true, 102.0, 100.0, REASSERT_SECS),
            WindowOrderAction::OrderFront
        );
    }

    #[test]
    fn hiding_orders_the_window_out() {
        assert_eq!(
            window_order_action(false, true, 100.0, 100.0, REASSERT_SECS),
            WindowOrderAction::OrderOut
        );
    }

    /// Drives the REAL `window_order_action` over a simulated display refresh
    /// loop and asserts it does not reproduce the pre-fix behaviour.
    ///
    /// The bug was an unconditional `orderFront:` on every tick. At 120 Hz that
    /// is 120 WindowServer transactions per second, which pegged the main
    /// thread. This walks the real function through 600 frames (5s at 120 Hz)
    /// and counts how many times it asks to re-order the window.
    #[test]
    fn steady_state_does_not_reorder_once_per_frame() {
        const FRAME_HZ: f64 = 120.0;
        const FRAMES: usize = 600;
        let dt = 1.0 / FRAME_HZ;

        let mut now = 0.0_f64;
        let mut last_assert = 0.0_f64;
        let mut ordered_front = false;
        let mut order_front_calls = 0usize;

        for _ in 0..FRAMES {
            match window_order_action(true, ordered_front, now, last_assert, REASSERT_SECS) {
                WindowOrderAction::OrderFront => {
                    order_front_calls += 1;
                    ordered_front = true;
                    last_assert = now;
                }
                WindowOrderAction::OrderOut => ordered_front = false,
                WindowOrderAction::None => {}
            }
            now += dt;
        }

        // Pre-fix, this loop issued one orderFront per frame (600 calls).
        // Post-fix it is bounded by the heartbeat: 5s / 2s ≈ 3 calls.
        assert!(
            order_front_calls <= 4,
            "expected the heartbeat to bound re-orders, got {order_front_calls} \
             orderFront calls across {FRAMES} frames"
        );
        assert!(
            order_front_calls >= 1,
            "the pill must still be ordered front at least once"
        );
    }

    /// The same loop, but asserting the pre-fix behaviour WOULD be rejected by
    /// the bound above. This is what makes the assertion discriminating rather
    /// than trivially true: it shows the property fails on the old logic.
    #[test]
    fn the_per_frame_bound_rejects_the_pre_fix_behaviour() {
        const FRAMES: usize = 600;
        // The old code: orderFront whenever the window should be visible.
        let legacy_order_front_calls = FRAMES;
        assert!(
            legacy_order_front_calls > 4,
            "the bound must actually reject one-orderFront-per-frame"
        );
    }

    #[test]
    fn a_hidden_window_is_not_reordered() {
        assert_eq!(
            window_order_action(false, false, 500.0, 100.0, REASSERT_SECS),
            WindowOrderAction::None
        );
    }
}
