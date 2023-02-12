/* 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * Author: alexandrecvieira
 */

/* exported init */

const { Clutter, GObject, St } = imports.gi;

const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const PanelMenu = imports.ui.panelMenu;
const Volume = imports.ui.status.volume;

const Indicator = GObject.registerClass(
  class Indicator extends PanelMenu.Button {
    _init() {
      super._init(0.0, _('Volume OSD Always'), true);

      this.hide();

      this.layout_manager_id = Main.layoutManager.connect('monitors-changed', () => {
	this._repatch.bind(this);
      });

      this._stream_changed_id = Volume.getMixerControl().connect('stream-changed', () => {
	this.osdWindows.show();
      });

      this._patch();
    }

    _repatch() {
      this._unpatch();
      this._patch();
    }

    _updateVisible() {
      for (const w of this.osdWindows) {
	w._vbox.remove_child(w._label);
	w._numlabel_right.visible = true;
	w._icon.visible = true;
      }
    }

    _patch() {
      // patching children in js/ui/osdWindow.js::OsdWindow
      for (const w of this.osdWindows) {
	const numlabel = new St.Label({
	  y_expand: true,
	  y_align: Clutter.ActorAlign.CENTER,
	  style_class: `number-label _numlabel_right`,
	});
	w._level.bind_property_full(
	  'value',
	  numlabel,
	  'text',
	  GObject.BindingFlags.SYNC_CREATE,
	  (__, v) => [true, (v * 100).toFixed()],
	  null
	);
	w[`_numlabel_right`] = numlabel;
	w._levelSignalId = w._level.connect(
	  'notify::visible',
	  this._updateVisible.bind(this)
	);
	const b = w._hbox;
	b.remove_all_children();
	b.add_child(w._icon);
	b.add_child(w._vbox);
	b.add_child(w._numlabel_right);
      }
      this._updateVisible();
    }

    _unpatch() {
      for (const w of this.osdWindows) {
	w._numlabel_left.destroy();
	delete w['_numlabel_left'];
	w._level.disconnect(w._levelSignalId);
	delete w['_levelSignalId'];
	w._icon.visible = true;
	w._hbox.remove_all_children();
	w._hbox.add_child(w._icon);
	w._hbox.add_child(w._vbox);
	w._vbox.add_child(w._label);
      }
    }

    get osdWindows() {
      return Main.osdWindowManager._osdWindows;
    }

    _onDestroy() {
      if (this.layout_manager_id) {
	Main.layoutManager.disconnect(this.layout_manager_id);
      }
      this._unpatch();
      if (this._source)
	Mainloop.source_remove(this._source);  
      if (this._stream_changed_id)
	Volume.getMixerControl().disconnect(this._stream_changed_id);
      super._onDestroy();
    }
  });

class Extension {
  constructor(uuid) {
    this._uuid = uuid;
  }

  enable() {
    this._indicator = new Indicator();
    Main.panel.addToStatusArea(this._uuid, this._indicator);
  }

  disable() {
    this._indicator.destroy();
    this._indicator = null;
  }
}

function init(meta) {
  return new Extension(meta.uuid);
}
