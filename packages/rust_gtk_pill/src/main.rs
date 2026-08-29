mod constants;
mod draw;
mod input;
mod ipc;
mod pill;
mod state;
mod theme;
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
    // A stale XAUTHORITY (e.g. the app was launched from a shell that outlived
    // the login session) makes the X11 backend unusable. Fall back to whatever
    // GDK can open rather than exiting, so the pill still appears.
    if gtk::init().is_err() {
        eprintln!("[pill] X11 backend unavailable, falling back to the default backend");
        std::env::remove_var("GDK_BACKEND");
        gtk::init().expect("Failed to initialize GTK");
    }
    let (sender, receiver) = std::sync::mpsc::channel();
    ipc::start_stdin_reader(sender);
    pill::run(receiver);
}
