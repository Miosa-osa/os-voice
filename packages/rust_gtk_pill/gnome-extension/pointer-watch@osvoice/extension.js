import Gio from "gi://Gio";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

const IFACE = `<node>
  <interface name="org.osvoice.PointerWatch">
    <method name="GetPointer">
      <arg type="i" direction="out" name="x"/>
      <arg type="i" direction="out" name="y"/>
    </method>
  </interface>
</node>`;

// global.get_pointer() returns the position of the last input event the shell
// itself processed, so it goes stale while the cursor sits over a client
// window (an XWayland one in particular). The cursor tracker follows the
// hardware cursor everywhere, so prefer it and keep the latest position
// cached from its invalidation signal.
export default class PointerWatchExtension extends Extension {
  enable() {
    this._tracker = null;
    this._trackerId = 0;
    this._cached = null;

    try {
      this._tracker = global.backend?.get_cursor_tracker?.() ?? null;
    } catch (_) {
      this._tracker = null;
    }

    if (this._tracker) {
      const update = () => {
        const pos = this._readTracker();
        if (pos) this._cached = pos;
      };
      for (const signal of ["position-invalidated", "cursor-moved"]) {
        try {
          this._trackerId = this._tracker.connect(signal, update);
          break;
        } catch (_) {
          this._trackerId = 0;
        }
      }
      update();
    }

    this._dbus = Gio.DBusExportedObject.wrapJSObject(IFACE, this);
    this._dbus.export(Gio.DBus.session, "/org/osvoice/PointerWatch");
  }

  disable() {
    if (this._tracker && this._trackerId) {
      try {
        this._tracker.disconnect(this._trackerId);
      } catch (_) {}
    }
    this._tracker = null;
    this._trackerId = 0;
    this._cached = null;

    if (this._dbus) {
      this._dbus.unexport();
      this._dbus = null;
    }
  }

  _readTracker() {
    if (!this._tracker) return null;
    try {
      const result = this._tracker.get_pointer();
      if (!result) return null;
      const [x, y] = result;
      if (typeof x === "number" && typeof y === "number")
        return [Math.round(x), Math.round(y)];
    } catch (_) {}
    return null;
  }

  GetPointer() {
    const live = this._readTracker();
    if (live) return live;
    if (this._cached) return this._cached;
    const [x, y] = global.get_pointer();
    return [Math.round(x), Math.round(y)];
  }
}
