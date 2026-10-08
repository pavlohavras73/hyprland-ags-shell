import app from "ags/gtk3/app"
import { createState, For } from "ags"
import { Astal, Gdk, Gtk } from "ags/gtk3"
import { getAllDesktopApps, CustomApp } from "../services/allDesktopApps"

const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor

function chunkCustomApps(items: CustomApp[], size = 6): CustomApp[][] {
  const chunks: CustomApp[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

export default function Launcher() {
  let win: Astal.Window
  let entry: Gtk.Entry

  const initialApps = getAllDesktopApps()
  const [list, setList] = createState<CustomApp[]>(initialApps)

  function search(text: string) {
    const all = getAllDesktopApps()
    if (!text.trim()) {
      setList(all)
    } else {
      const q = text.toLowerCase().trim()
      setList(all.filter((a) => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)))
    }
  }

  function launch(appItem?: CustomApp) {
    if (appItem) {
      win.visible = false
      appItem.launch()
    }
  }

  return (
    <window
      $={(self: Astal.Window) => (win = self)}
      name="launcher"
      class="Launcher"
      visible={false}
      application={app}
      anchor={TOP | BOTTOM | LEFT | RIGHT}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.EXCLUSIVE}
      onNotifyVisible={(self: Astal.Window) => {
        if (self.visible) {
          self.show_all()
          if (entry) entry.grab_focus()
        } else {
          if (entry) entry.set_text("")
          setList(getAllDesktopApps())
        }
      }}
      onKeyPressEvent={(self, e) => {
        const event = e as unknown as Gdk.Event
        if (event.get_keyval()[1] === Gdk.KEY_Escape) {
          self.visible = false
        }
      }}
      onButtonPressEvent={(self: Astal.Window) => {
        self.visible = false
      }}
    >
      <box
        class="launcher-fullscreen-container"
        vertical
        expand
        halign={Gtk.Align.FILL}
        valign={Gtk.Align.FILL}
        onButtonPressEvent={() => true}
      >
        <box class="launcher-top-bar" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
          <entry
            $={(self: Gtk.Entry) => (entry = self)}
            class="launcher-search-entry"
            placeholderText="🔍 Поиск всех приложений Ubuntu..."
            onNotifyText={(self: Gtk.Entry) => search(self.text)}
          />
          <button class="launcher-close-btn" onClicked={() => { if (win) win.visible = false }}>
            <label label="✕" />
          </button>
        </box>

        <scrollable
          class="app-grid-scroll"
          hscrollbarPolicy={Gtk.PolicyType.NEVER}
          vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
          vexpand
          hexpand
        >
          <box vertical spacing={16} class="app-grid-rows" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
            <For each={list((items) => chunkCustomApps(items, 6))}>
              {(row) => (
                <box spacing={16} halign={Gtk.Align.CENTER}>
                  {row.map((appItem) => (
                    <button
                      class="app-grid-tile"
                      tooltipText={appItem.description || appItem.name}
                      onClicked={() => launch(appItem)}
                    >
                      <box vertical halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
                        <icon
                          class="app-grid-icon"
                          gicon={appItem.gicon}
                          pixelSize={64}
                        />
                        <label
                          class="app-grid-name"
                          label={appItem.name}
                          halign={Gtk.Align.CENTER}
                          ellipsize={3}
                        />
                      </box>
                    </button>
                  ))}
                </box>
              )}
            </For>
          </box>
        </scrollable>
      </box>
    </window>
  )
}
