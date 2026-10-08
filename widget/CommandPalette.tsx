import GLib from "gi://GLib"
import app from "ags/gtk3/app"
import { createState } from "ags"
import { Astal, Gdk, Gtk } from "ags/gtk3"
import { execAsync } from "ags/process"
import { callIntent, JarvisClientError } from "../services/jarvisClient"
import { dispatch } from "../services/dispatcher"

const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor

export default function CommandPalette() {
  let win: Astal.Window
  let entry: Gtk.Entry
  const [status, setStatus] = createState("")
  const [busy, setBusy] = createState(false)

  async function submit(text: string) {
    if (!text.trim() || busy.get()) return
    setBusy(true)
    setStatus("⚡ Обрабатываю интенты Jarvis...")
    try {
      const actions = await callIntent(text)
      if (actions.length === 0) {
        setStatus("⚠️ Не распознал ни одной разрешённой команды")
      } else {
        const results = await dispatch(actions)
        const failed = results.filter((r) => !r.ok)
        setStatus(
          failed.length === 0
            ? `✅ Выполнено: ${results.map((r) => r.action).join(", ")}`
            : `❌ Ошибка: ${failed.map((r) => `${r.action} — ${r.detail}`).join("; ")}`,
        )
      }
    } catch (e) {
      if (e instanceof JarvisClientError) {
        const kindLabel = { transport: "нет связи с сервером", auth: "неверный токен", parse: "битый ответ сервера", config: "не настроено" }[e.kind]
        setStatus(`❌ Ошибка (${kindLabel}): ${e.message}`)
      } else {
        setStatus(`❌ Ошибка: ${e}`)
      }
    } finally {
      setBusy(false)
    }
  }

  async function startVoiceInput() {
    if (busy.get()) return
    setBusy(true)
    setStatus("🎙️ Говорите (запись 4 секунды)...")
    try {
      const out = await execAsync([`${GLib.get_home_dir()}/.config/ags/scripts/voice_stt.py`, "4"])
      const res = JSON.parse(out)
      if (res.ok && res.text) {
        entry.set_text(res.text)
        setStatus(`🎙️ Распознано: «${res.text}»`)
        setBusy(false)
        await submit(res.text)
      } else {
        setStatus(`⚠️ ${res.error || "Речь не распознана"}`)
        setBusy(false)
      }
    } catch (e) {
      setStatus(`❌ Ошибка записи речи: ${e}`)
      setBusy(false)
    }
  }

  return (
    <window
      $={(self: Astal.Window) => (win = self)}
      name="command-palette"
      class="CommandPalette"
      visible={false}
      application={app}
      anchor={TOP | BOTTOM | LEFT | RIGHT}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.EXCLUSIVE}
      onNotifyVisible={(self: Astal.Window) => {
        if (self.visible) {
          self.show_all()
          entry.grab_focus()
        } else {
          entry.set_text("")
          setStatus("")
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
        class="palette-card-container"
        vertical
        halign={Gtk.Align.CENTER}
        valign={Gtk.Align.CENTER}
        onButtonPressEvent={() => true}
      >
        <box class="palette-header">
          <label class="palette-icon-badge" label="⚡" />
          <label class="palette-title" label="Командная палитра Jarvis OS" />
        </box>

        <box class="palette-input-row" spacing={8}>
          <entry
            $={(self: Gtk.Entry) => (entry = self)}
            class="palette-search-entry"
            hexpand
            placeholderText="Что сделать? (напр. «переключи на воркспейс 3» или нажмите 🎙️)..."
            onActivate={(self: Gtk.Entry) => submit(self.text)}
          />
          <button
            class="palette-mic-btn"
            tooltipText="Запись голоса (микрофон)"
            onClicked={startVoiceInput}
          >
            <label label="🎙️" />
          </button>
        </box>

        <box class="palette-status-card" visible={status((s) => s.length > 0)}>
          <label class="palette-status-text" label={status} wrap hexpand halign={Gtk.Align.START} />
        </box>
      </box>
    </window>
  )
}
