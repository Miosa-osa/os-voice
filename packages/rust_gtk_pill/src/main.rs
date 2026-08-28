mod constants;
mod draw;
mod input;
mod ipc;
mod pill;
mod state;
mod x11;

// GNOME has no layer-shell protocol, and plain Wayland windows cannot be
// positioned or moved by the client, so on GNOME the pill must run through
// XWayland where XMoveWindow and cursor queries work.
fn prefer_x11_on_gnome_wayland() {
    if std::env::var("WAYLAND_DISPLAY").is_err() || std::env::var("DISPLAY").is_err() {
        return;
    }
    let gnome = std::env::var("XDG_CURRENT_DESKTOP")
        .map(|d| d.to_uppercase().contains("GNOME"))
        .unwrap_or(false);
    if gnome {
        std::env::set_var("GDK_BACKEND", "x11");
    }
}

fn main() {
    prefer_x11_on_gnome_wayland();
    gtk::init().expect("Failed to initialize GTK");
    let (sender, receiver) = std::sync::mpsc::channel();
    ipc::start_stdin_reader(sender);
    pill::run(receiver);
}
