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

const { Gio, Clutter, GObject, St } = imports.gi;

const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const PanelMenu = imports.ui.panelMenu;
const Volume = imports.ui.status.volume;

const VolumeIcons =
      [
	'audio-volume-muted-symbolic',
	'audio-volume-low-symbolic',
	'audio-volume-medium-symbolic',
	'audio-volume-high-symbolic'
      ];

const Indicator = GObject.registerClass(
  class Indicator extends PanelMenu.Button {
    _init() {
      super._init(0.0, _('Volume OSD Always'), true);

      this.hide();

      this._default_sink = Volume.getMixerControl().get_default_sink();
      this.volume_max = Volume.getMixerControl().get_vol_max_norm();
      this.prevSinkVolume = null;

      this.layout_manager_id = Main.layoutManager.connect('monitors-changed', () => {
	this._repatch.bind(this);
      });

      this._default_sink_changed_id = Volume.getMixerControl().connect('default-sink-changed', () => {
	//log('DEFAULT-SINK-CHANGED');
	this._default_sink = Volume.getMixerControl().get_default_sink();           
      });
      
      this._stream_changed_id = Volume.getMixerControl().connect('stream-changed', () => {
	//log('STREAM-CHANGED');
	// Show Volume OSD
	this._showVolumeOSD();
      });
      
      this._patch();
    }

    _repatch() {
      this._unpatch();
      this._patch();
    }

    _showVolumeOSD() {
      let sinkVolume = this._default_sink.volume;

      if (this.prevSinkVolume === null){
	this.prevSinkVolume = sinkVolume; 
      }
      
      if (sinkVolume !== this.prevSinkVolume) {
	const percentage = sinkVolume / this.volume_max;
	let n;
	if (sinkVolume === 0)
	{
	  n = 0;
	}
	else
	{
	  n = parseInt(3 * percentage + 1);
	  n = Math.max(1, n);
	  n = Math.min(3, n);
	}
	const monitor = -1; // Display volume window on all monitors.
	const icon = Gio.Icon.new_for_string(VolumeIcons[n]);
	const label = "";
	Main.osdWindowManager.show(monitor, icon, label, percentage);
	this._patch();
	this.prevSinkVolume = sinkVolume;
	}
    }

    _repatch() {
      this._unpatch();
      this._patch();
    }

    _updateVisible() {
      for (const w of this.osdWindows) {
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
      if (this._default_sink_changed_id)
	Volume.getMixerControl().disconnect(this._default_sink_changed_id);   
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
