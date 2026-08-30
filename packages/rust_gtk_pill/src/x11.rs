use std::cell::{Cell, RefCell};
use std::ffi::{c_int, c_ulong, c_void};
use std::rc::Rc;
use std::time::{Duration, Instant};

use gtk::gdk;
use gtk::glib::{self, ControlFlow};
use gtk::prelude::*;

use crate::constants::MARGIN_BOTTOM;

const POINTER_RETRY_INTERVAL: Duration = Duration::from_secs(2);
use crate::theme::{Placement, Position};

// In a Wayland session the pill runs through XWayland, where GNOME's dock
// (a gnome-shell component) reserves no X11 struts, so _NET_WORKAREA does not
// exclude it and a bottom-anchored window lands under the dock. Read the dock's
// geometry from its gsettings instead. On a native X11 session struts work and
// no extra offset is needed.
struct DockReserve {
    height: f64,
    connector: String,
    all_monitors: bool,
}

impl DockReserve {
    fn applies_to(&self, monitor: &gdk::Monitor) -> bool {
        if self.all_monitors {
            return true;
        }
        if self.connector == "primary" {
            return monitor.is_primary();
        }
        monitor
            .model()
            .map(|m| m == self.connector.as_str())
            .unwrap_or(false)
    }
}

// XWayland only receives pointer events while the cursor is over an X11
// window, so XQueryPointer freezes whenever the cursor is over Wayland
// surfaces and the pill stops following the mouse. The pointer-watch@osvoice
// shell extension exposes gnome-shell's own pointer position over DBus;
// prefer it and fall back to XQueryPointer when it is unavailable.
fn pointer_watch_proxy() -> Option<gtk::gio::DBusProxy> {
    use gtk::gio;
    if std::env::var("WAYLAND_DISPLAY").is_err() {
        return None;
    }
    gio::DBusProxy::for_bus_sync(
        gio::BusType::Session,
        gio::DBusProxyFlags::DO_NOT_LOAD_PROPERTIES
            | gio::DBusProxyFlags::DO_NOT_CONNECT_SIGNALS,
        None,
        "org.gnome.Shell",
        "/org/osvoice/PointerWatch",
        "org.osvoice.PointerWatch",
        None::<&gtk::gio::Cancellable>,
    )
    .ok()
}

fn detect_wayland_dock_reserve() -> Option<DockReserve> {
    if std::env::var("WAYLAND_DISPLAY").is_err() {
        return None;
    }
    let get = |key: &str| -> Option<String> {
        let out = std::process::Command::new("gsettings")
            .args(["get", "org.gnome.shell.extensions.dash-to-dock", key])
            .output()
            .ok()?;
        if !out.status.success() {
            return None;
        }
        Some(
            String::from_utf8_lossy(&out.stdout)
                .trim()
                .trim_matches('\'')
                .to_string(),
        )
    };
    if get("dock-position")?.as_str() != "BOTTOM" {
        return None;
    }
    let icon_size: f64 = get("dash-max-icon-size")
        .and_then(|s| s.parse().ok())
        .unwrap_or(48.0);
    let connector = get("preferred-monitor-by-connector").unwrap_or_else(|| "primary".to_string());
    let all_monitors = get("multi-monitor").as_deref() == Some("true");
    Some(DockReserve {
        height: icon_size + 28.0,
        connector,
        all_monitors,
    })
}

pub(crate) fn setup_x11_window(window: &gtk::Window, placement: Rc<Cell<Placement>>) {
    use std::ffi::{c_char, c_int, c_uchar, c_uint, c_ulong, c_void};

    type XDisplay = c_void;
    type XWindow = c_ulong;
    type XAtom = c_ulong;

    const XA_ATOM: XAtom = 4;

    extern "C" {
        fn gdk_x11_display_get_xdisplay(display: *mut c_void) -> *mut XDisplay;
        fn gdk_x11_window_get_xid(window: *mut c_void) -> XWindow;
    }

    #[link(name = "X11")]
    extern "C" {
        fn XInternAtom(
            display: *mut XDisplay, name: *const c_char, only_if_exists: c_int,
        ) -> XAtom;
        fn XChangeProperty(
            display: *mut XDisplay, w: XWindow, property: XAtom, type_: XAtom,
            format: c_int, mode: c_int, data: *const c_uchar, nelements: c_int,
        ) -> c_int;
        fn XMoveWindow(display: *mut XDisplay, w: XWindow, x: c_int, y: c_int) -> c_int;
        fn XFlush(display: *mut XDisplay) -> c_int;
        fn XDefaultRootWindow(display: *mut XDisplay) -> XWindow;
        fn XQueryPointer(
            display: *mut XDisplay, w: XWindow,
            root_return: *mut XWindow, child_return: *mut XWindow,
            root_x_return: *mut c_int, root_y_return: *mut c_int,
            win_x_return: *mut c_int, win_y_return: *mut c_int,
            mask_return: *mut c_uint,
        ) -> c_int;
    }

    let display = window.display();
    let gdk_window = window.window().expect("window after realize");

    let xdisplay = unsafe {
        gdk_x11_display_get_xdisplay(
            glib::translate::ToGlibPtr::<*mut gdk::ffi::GdkDisplay>::to_glib_none(&display).0
                as *mut c_void,
        )
    };
    let xwindow = unsafe {
        gdk_x11_window_get_xid(
            glib::translate::ToGlibPtr::<*mut gdk::ffi::GdkWindow>::to_glib_none(&gdk_window).0
                as *mut c_void,
        )
    };

    unsafe {
        let intern = |name: &[u8]| -> XAtom {
            XInternAtom(xdisplay, name.as_ptr() as *const c_char, 0)
        };

        let wm_window_type = intern(b"_NET_WM_WINDOW_TYPE\0");
        let type_dock = intern(b"_NET_WM_WINDOW_TYPE_DOCK\0");
        XChangeProperty(
            xdisplay, xwindow, wm_window_type, XA_ATOM, 32, 0,
            &type_dock as *const XAtom as *const c_uchar, 1,
        );

        let wm_state = intern(b"_NET_WM_STATE\0");
        let states = [
            intern(b"_NET_WM_STATE_ABOVE\0"),
            intern(b"_NET_WM_STATE_STICKY\0"),
            intern(b"_NET_WM_STATE_SKIP_TASKBAR\0"),
            intern(b"_NET_WM_STATE_SKIP_PAGER\0"),
        ];
        XChangeProperty(
            xdisplay, xwindow, wm_state, XA_ATOM, 32, 0,
            states.as_ptr() as *const c_uchar, states.len() as c_int,
        );

        XFlush(xdisplay);
    }

    // The cursor position is fetched ASYNCHRONOUSLY. A synchronous DBus call
    // on the GTK main thread blocks rendering whenever gnome-shell is busy —
    // the call times out and the pill visibly freezes mid-animation. Here the
    // timer only ever reads the last delivered value, so drawing never waits
    // on the compositor. The proxy is also rebuilt on demand because at login
    // the pill starts before gnome-shell has loaded the extension.
    let pointer_cache: Rc<Cell<Option<(c_int, c_int)>>> = Rc::new(Cell::new(None));
    let pointer_inflight: Rc<Cell<bool>> = Rc::new(Cell::new(false));
    let pointer_proxy: Rc<RefCell<Option<gtk::gio::DBusProxy>>> =
        Rc::new(RefCell::new(pointer_watch_proxy()));
    let pointer_retry: Rc<Cell<Instant>> = Rc::new(Cell::new(
        Instant::now() - POINTER_RETRY_INTERVAL,
    ));

    let refresh_pointer = {
        let cache = pointer_cache.clone();
        let inflight = pointer_inflight.clone();
        let proxy_cell = pointer_proxy.clone();
        let retry = pointer_retry.clone();
        move || {
            if inflight.get() {
                return;
            }
            let proxy = {
                let mut guard = proxy_cell.borrow_mut();
                if guard.is_none() && retry.get().elapsed() >= POINTER_RETRY_INTERVAL {
                    retry.set(Instant::now());
                    *guard = pointer_watch_proxy();
                    if guard.is_some() {
                        eprintln!("[pill] pointer-watch service acquired");
                    }
                }
                guard.clone()
            };
            let Some(proxy) = proxy else {
                return;
            };
            inflight.set(true);
            let cache = cache.clone();
            let inflight = inflight.clone();
            let proxy_cell = proxy_cell.clone();
            let retry = retry.clone();
            proxy.call(
                "GetPointer",
                None,
                gtk::gio::DBusCallFlags::NONE,
                1000,
                None::<&gtk::gio::Cancellable>,
                move |result| {
                    inflight.set(false);
                    match result {
                        Ok(value) => match value.get::<(i32, i32)>() {
                            Some((x, y)) => cache.set(Some((x as c_int, y as c_int))),
                            None => {
                                eprintln!("[pill] pointer-watch sent an unexpected reply");
                                *proxy_cell.borrow_mut() = None;
                                retry.set(Instant::now());
                            }
                        },
                        Err(err) => {
                            eprintln!("[pill] pointer-watch call failed ({err}); using X11 cursor");
                            *proxy_cell.borrow_mut() = None;
                            retry.set(Instant::now());
                        }
                    }
                },
            );
        }
    };

    let cursor_pos = move || -> (c_int, c_int) {
        refresh_pointer();
        if let Some(position) = pointer_cache.get() {
            return position;
        }
        unsafe {
            let root = XDefaultRootWindow(xdisplay);
            let (mut rx, mut ry) = (0 as c_int, 0 as c_int);
            let (mut dw1, mut dw2) = (0 as XWindow, 0 as XWindow);
            let (mut dx, mut dy) = (0 as c_int, 0 as c_int);
            let mut dm: c_uint = 0;
            XQueryPointer(
                xdisplay, root, &mut dw1, &mut dw2,
                &mut rx, &mut ry, &mut dx, &mut dy, &mut dm,
            );
            (rx, ry)
        }
    };

    let win_ref = window.clone();
    let dock_reserve = detect_wayland_dock_reserve();
    let pill_pos_on_monitor =
        move |cx: c_int, cy: c_int, disp: &gdk::Display| -> Option<(c_int, c_int)> {
            let n = disp.n_monitors();
            for i in 0..n {
                let monitor = disp.monitor(i)?;
                let g = monitor.geometry();
                let scale = monitor.scale_factor() as f64;
                let phys_x = g.x() as f64 * scale;
                let phys_y = g.y() as f64 * scale;
                let phys_w = g.width() as f64 * scale;
                let phys_h = g.height() as f64 * scale;
                if (cx as f64) >= phys_x && (cx as f64) < phys_x + phys_w
                    && (cy as f64) >= phys_y && (cy as f64) < phys_y + phys_h
                {
                    let wa = monitor.workarea();
                    let wa_x = wa.x() as f64 * scale;
                    let wa_y = wa.y() as f64 * scale;
                    let wa_w = wa.width() as f64 * scale;
                    let wa_h = wa.height() as f64 * scale;
                    let (alloc_w, alloc_h) = win_ref.size();
                    let win_w = alloc_w as f64;
                    let win_h = alloc_h as f64;
                    let dock = match &dock_reserve {
                        Some(d) if d.applies_to(&monitor) => d.height,
                        _ => 0.0,
                    };
                    let placement = placement.get();
                    let margin = (MARGIN_BOTTOM as f64 + dock + placement.bottom_offset) * scale;
                    let side_margin = 24.0 * scale;
                    let pill_inset = (win_w - placement.pill_width * scale) / 2.0;
                    let x = match placement.position {
                        Position::Left => wa_x + side_margin - pill_inset,
                        Position::Center => wa_x + (wa_w - win_w) / 2.0,
                        Position::Right => wa_x + wa_w - side_margin - win_w + pill_inset,
                    };
                    return Some((x as c_int, (wa_y + wa_h - win_h - margin) as c_int));
                }
            }
            None
        };

    let (cx, cy) = cursor_pos();
    let init_pos = pill_pos_on_monitor(cx, cy, &display).unwrap_or((0, 0));
    unsafe {
        XMoveWindow(xdisplay, xwindow, init_pos.0, init_pos.1);
        XFlush(xdisplay);
    }

    let last_pos = Rc::new(Cell::new(init_pos));
    glib::timeout_add_local(Duration::from_millis(100), move || {
        let (cx, cy) = cursor_pos();
        if let Some((new_x, new_y)) = pill_pos_on_monitor(cx, cy, &display) {
            let prev = last_pos.get();
            if new_x != prev.0 || new_y != prev.1 {
                last_pos.set((new_x, new_y));
                unsafe {
                    XMoveWindow(xdisplay, xwindow, new_x, new_y);
                    XFlush(xdisplay);
                }
            }
        }
        ControlFlow::Continue
    });
}

pub(crate) fn force_keyboard_focus(window: &gtk::Window) {
    type XDisplay = c_void;
    type XWindow = c_ulong;

    extern "C" {
        fn gdk_x11_display_get_xdisplay(display: *mut c_void) -> *mut XDisplay;
        fn gdk_x11_window_get_xid(window: *mut c_void) -> XWindow;
    }

    #[link(name = "X11")]
    extern "C" {
        fn XSetInputFocus(
            display: *mut XDisplay, focus: XWindow, revert_to: c_int, time: c_ulong,
        ) -> c_int;
        fn XFlush(display: *mut XDisplay) -> c_int;
    }

    let gdk_window = match window.window() {
        Some(w) if w.is_visible() => w,
        _ => return,
    };
    let display = window.display();

    unsafe {
        let xdisplay = gdk_x11_display_get_xdisplay(
            glib::translate::ToGlibPtr::<*mut gdk::ffi::GdkDisplay>::to_glib_none(&display).0
                as *mut c_void,
        );
        let xwindow = gdk_x11_window_get_xid(
            glib::translate::ToGlibPtr::<*mut gdk::ffi::GdkWindow>::to_glib_none(&gdk_window).0
                as *mut c_void,
        );
        XSetInputFocus(xdisplay, xwindow, 1, 0);
        XFlush(xdisplay);
    }
}
