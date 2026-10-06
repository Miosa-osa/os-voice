use gtk::cairo;
use rust_pill_style::waves::{Canvas, Stop};
pub(crate) struct WaveCanvas<'a>(pub &'a cairo::Context);
impl Canvas for WaveCanvas<'_> {
    fn save(&self) {
        let _ = self.0.save();
    }
    fn restore(&self) {
        let _ = self.0.restore();
    }
    fn stroke(&self) {
        let _ = self.0.stroke();
    }
    fn fill(&self) {
        let _ = self.0.fill();
    }
    fn clip(&self) {
        self.0.clip();
    }
    fn move_to(&self, x: f64, y: f64) {
        self.0.move_to(x, y);
    }
    fn line_to(&self, x: f64, y: f64) {
        self.0.line_to(x, y);
    }
    fn arc(&self, x: f64, y: f64, r: f64, start: f64, end: f64) {
        self.0.arc(x, y, r, start, end);
    }
    fn close_path(&self) {
        self.0.close_path();
    }
    fn set_source_rgba(&self, r: f64, g: f64, b: f64, a: f64) {
        self.0.set_source_rgba(r, g, b, a);
    }
    fn set_line_width(&self, w: f64) {
        self.0.set_line_width(w);
    }
    fn round_lines(&self) {
        self.0.set_line_cap(cairo::LineCap::Round);
        self.0.set_line_join(cairo::LineJoin::Round);
    }
    fn rounded_rect(&self, x: f64, y: f64, w: f64, h: f64, r: f64) {
        use std::f64::consts::PI;
        self.0.new_sub_path();
        self.0.arc(x + w - r, y + r, r, -PI / 2.0, 0.0);
        self.0.arc(x + w - r, y + h - r, r, 0.0, PI / 2.0);
        self.0.arc(x + r, y + h - r, r, PI / 2.0, PI);
        self.0.arc(x + r, y + r, r, PI, 1.5 * PI);
        self.0.close_path();
    }
    fn linear_source(&self, x1: f64, x2: f64, stops: &[Stop]) {
        let g = cairo::LinearGradient::new(x1, 0.0, x2, 0.0);
        for &(t, r, b, c, a) in stops {
            g.add_color_stop_rgba(t, r, b, c, a);
        }
        let _ = self.0.set_source(g);
    }
    fn radial_source(
        &self,
        (x1, y1, r1, x2, y2, r2): (f64, f64, f64, f64, f64, f64),
        stops: &[Stop],
    ) {
        let g = cairo::RadialGradient::new(x1, y1, r1, x2, y2, r2);
        for &(t, r, b, c, a) in stops {
            g.add_color_stop_rgba(t, r, b, c, a);
        }
        let _ = self.0.set_source(g);
    }
}
