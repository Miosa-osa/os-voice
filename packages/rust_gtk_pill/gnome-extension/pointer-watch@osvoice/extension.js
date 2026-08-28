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

export default class PointerWatchExtension extends Extension {
  enable() {
    this._dbus = Gio.DBusExportedObject.wrapJSObject(IFACE, this);
    this._dbus.export(Gio.DBus.session, "/org/osvoice/PointerWatch");
  }

  disable() {
    if (this._dbus) {
      this._dbus.unexport();
      this._dbus = null;
    }
  }

  GetPointer() {
    const [x, y] = global.get_pointer();
    return [x, y];
  }
}
