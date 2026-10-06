# pointer-watch@osvoice

GNOME Shell extension that exposes the global pointer position over DBus
(`org.gnome.Shell` / `/org/osvoice/PointerWatch` / `GetPointer() -> (x, y)`).

On GNOME Wayland the pill runs through XWayland, which only sees the pointer
while it is over an X11 window. The pill queries this extension instead so it
can follow the cursor across monitors and Wayland surfaces.

Install:

```sh
cp -r pointer-watch@osvoice ~/.local/share/gnome-shell/extensions/
gnome-extensions enable pointer-watch@osvoice   # takes effect after re-login on Wayland
```
