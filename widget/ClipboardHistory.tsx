import app from "ags/gtk3/app"
import { createState, For } from "ags"
import { Astal, Gdk, Gtk } from "ags/gtk3"
import { execAsync } from "ags/process"

const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor

interface ClipEntry {
  id: string
  preview: string
}

function parseList(raw: string): ClipEntry[] {
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const tab = line.indexOf("\t")
      if (tab === -1) return { id: line, preview: line }
      return { id: line.slice(0, tab), preview: line.slice(tab + 1) }
    })
}

export default function ClipboardHistory() {
  let win: Astal.Window
  let entry: Gtk.Entry

  const [all, setAll] = createState(new Array<ClipEntry>())
  const [filtered, setFiltered] = createState(new Array<ClipEntry>())

  function refresh() {
    execAsync(["cliphist", "list"])
      .then((out) => {
        const entries = parseList(out)
        setAll(entries)
        setFiltered(entries)
      })
      .catch((e) => console.error("[clipboard] list failed:", e))
  }

  function search(text: string) {
    const items = all.get()
    if (!text.trim()) {
      setFiltered(items)
      return
    }
    const needle = text.toLowerCase()
    setFiltered(items.filter((it) => it.preview.toLowerCase().includes(needle)))
  }

  function pick(item: ClipEntry) {
    win.visible = false
    // decode только по префиксу "id\t" — реальный превью-текст не нужен,
    // так избегаем экранирования произвольного содержимого буфера в шелле.
    execAsync([
      "bash",
      "-c",
      `printf '%s\\t\\n' ${JSON.stringify(item.id)} | cliphist decode | wl-copy`,
    ]).catch((e) => console.error("[clipboard] copy failed:", e))
  }

  function del(item: ClipEntry) {
    execAsync(["bash", "-c", `printf '%s\\t\\n' ${JSON.stringify(item.id)} | cliphist delete`])
      .then(refresh)
      .catch((e) => console.error("[clipboard] delete failed:", e))
  }

  return (
    <window
      $={(self: Astal.Window) => (win = self)}
      name="clipboard"
      class="ClipboardHistory"
      visible={false}
      application={app}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.EXCLUSIVE}
      onNotifyVisible={(self: Astal.Window) => {
        if (self.visible) {
          self.show_all()
          self.present()
          refresh()
          entry.grab_focus()
        } else {
          entry.set_text("")
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
        class="clipboard-content"
        vertical
        halign={Gtk.Align.CENTER}
        valign={Gtk.Align.CENTER}
        onButtonPressEvent={() => true}
      >
        <label class="clipboard-title" label="Буфер обмена" />
        <entry
          $={(self: Gtk.Entry) => (entry = self)}
          placeholderText="Фильтр…"
          onNotifyText={(self: Gtk.Entry) => search(self.text)}
        />
        <box vertical class="clipboard-list">
          <For each={filtered}>
            {(item) => (
              <box class="clipboard-row">
                <button hexpand onClicked={() => pick(item)}>
                  <label
                    label={item.preview.replace(/\s+/g, " ").slice(0, 80)}
                    halign={Gtk.Align.START}
                    ellipsize={3}
                  />
                </button>
                <button class="clipboard-delete" onClicked={() => del(item)}>
                  <icon icon="edit-delete-symbolic" />
                </button>
              </box>
            )}
          </For>
        </box>
      </box>
    </window>
  )
}
