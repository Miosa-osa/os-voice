use crate::gfx::{self, Ctx};
use rust_pill_style::waves::{Canvas, Stop};
use std::cell::RefCell;
#[derive(Clone, Default)]
enum Brush {
    #[default]
    Solid,
    Linear(f64, f64, Vec<Stop>),
    Radial((f64, f64, f64, f64, f64, f64), Vec<Stop>),
}
pub(crate) struct WaveCanvas<'a> {
    ctx: &'a Ctx,
    brush: RefCell<Brush>,
    stack: RefCell<Vec<Brush>>,
}
impl<'a> WaveCanvas<'a> {
    pub(crate) fn new(ctx: &'a Ctx) -> Self {
        Self {
            ctx,
            brush: RefCell::new(Brush::Solid),
            stack: RefCell::new(Vec::new()),
        }
    }
    fn paint(&self, stroke: bool) {
        match &*self.brush.borrow() {
            Brush::Solid => {
                if stroke {
                    self.ctx.stroke()
                } else {
                    self.ctx.fill()
                }
            }
            brush => {
                self.ctx.save();
                if stroke {
                    self.ctx.clip_stroke()
                } else {
                    self.ctx.clip()
                }
                match brush {
                    Brush::Linear(x1, x2, stops) => {
                        self.ctx.draw_gradient_raw(*x1, 0.0, *x2, 0.0, stops)
                    }
                    Brush::Radial(geometry, stops) => self.ctx.radial_gradient(*geometry, stops),
                    Brush::Solid => {}
                }
                self.ctx.restore();
            }
        }
    }
}
impl Canvas for WaveCanvas<'_> {
    fn save(&self) {
        self.stack.borrow_mut().push(self.brush.borrow().clone());
        self.ctx.save();
    }
    fn restore(&self) {
        self.ctx.restore();
        if let Some(b) = self.stack.borrow_mut().pop() {
            *self.brush.borrow_mut() = b;
        }
    }
    fn stroke(&self) {
        self.paint(true)
    }
    fn fill(&self) {
        self.paint(false)
    }
    fn round_lines(&self) {
        self.ctx.set_line_cap_round();
        self.ctx.set_line_join_round();
    }
    fn rounded_rect(&self, x: f64, y: f64, w: f64, h: f64, r: f64) {
        gfx::rounded_rect(self.ctx, x, y, w, h, r);
    }
    fn linear_source(&self, x1: f64, x2: f64, stops: &[Stop]) {
        *self.brush.borrow_mut() = Brush::Linear(x1, x2, stops.to_vec());
    }
    fn radial_source(&self, geometry: (f64, f64, f64, f64, f64, f64), stops: &[Stop]) {
        *self.brush.borrow_mut() = Brush::Radial(geometry, stops.to_vec());
    }
    fn set_source_rgba(&self, r: f64, g: f64, b: f64, a: f64) {
        *self.brush.borrow_mut() = Brush::Solid;
        self.ctx.set_source_rgba(r, g, b, a);
    }
    fn clip(&self) {
        self.ctx.clip();
    }
    fn move_to(&self, x: f64, y: f64) {
        self.ctx.move_to(x, y);
    }
    fn line_to(&self, x: f64, y: f64) {
        self.ctx.line_to(x, y);
    }
    fn arc(&self, x: f64, y: f64, r: f64, start: f64, end: f64) {
        self.ctx.arc(x, y, r, start, end);
    }
    fn close_path(&self) {
        self.ctx.close_path();
    }
    fn set_line_width(&self, w: f64) {
        self.ctx.set_line_width(w);
    }
}
