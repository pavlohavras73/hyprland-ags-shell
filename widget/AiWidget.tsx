import GLib from "gi://GLib"
import app from "ags/gtk3/app"
import { createState, For } from "ags"
import { Astal, Gdk, Gtk } from "ags/gtk3"
import { execAsync } from "ags/process"
import { callAiPrompt, JarvisClientError } from "../services/jarvisClient"
import { dispatch } from "../services/dispatcher"

interface ChatMessage {
  id: string
  role: "user" | "ai"
  text: string
}

const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor

export default function AiWidget() {
  let win: Astal.Window
  let entry: Gtk.Entry
  const [history, setHistory] = createState<ChatMessage[]>([])
  const [status, setStatus] = createState("")
  const [busy, setBusy] = createState(false)

  async function submit(text: string) {
    if (!text.trim() || busy.get()) return
    const userQuery = text.trim()
    setBusy(true)
    setStatus("🤖 Jarvis размышляет... • • •")

    const userMsg: ChatMessage = { id: `u_${Date.now()}`, role: "user", text: userQuery }
    const current = history.get()
    setHistory([...current, userMsg])
    if (entry) entry.set_text("")

    try {
      const res = await callAiPrompt(userQuery)
      const aiReply = res.reply

      let finalText = aiReply
      if (res.actions && res.actions.length > 0) {
        const dispatchResults = await dispatch(res.actions)
        const okCount = dispatchResults.filter((r) => r.ok).length
        finalText = `${aiReply}\n\n[Выполнено действий: ${okCount}/${res.actions.length}]`
      }

      const aiMsg: ChatMessage = { id: `a_${Date.now()}`, role: "ai", text: finalText }
      setHistory([...history.get(), aiMsg])
      setStatus("")
    } catch (e) {
      if (e instanceof JarvisClientError) {
        setStatus(`❌ Ошибка: ${e.message}`)
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
    setStatus("🎙️ Говорите в микрофон (запись 4 секунды)...")
    try {
      const out = await execAsync([`${GLib.get_home_dir()}/.config/ags/scripts/voice_stt.py`, "4"])
      const res = JSON.parse(out)
      if (res.ok && res.text) {
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
      name="ai-widget"
      class="AiWidget"
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
        class="ai-card-container"
        vertical
        halign={Gtk.Align.CENTER}
        valign={Gtk.Align.CENTER}
        onButtonPressEvent={() => true}
      >
        <box class="ai-header" halign={Gtk.Align.FILL}>
          <label class="ai-title" label="🤖 Jarvis AI Assistant" />
          <box hexpand />
          <button class="ai-close-btn" onClicked={() => { if (win) win.visible = false }}>
            <label label="✕" />
          </button>
        </box>

        <scrollable class="ai-chat-scroll" hscrollbarPolicy={Gtk.PolicyType.NEVER} vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}>
          <box class="ai-chat-list" vertical>
            <For each={history}>
              {(item: ChatMessage) => (
                <box class={`chat-bubble-card ${item.role}`}>
                  <box class="chat-bubble-header">
                    <label class="chat-role-label" label={item.role === "user" ? "👤 Вы" : "🤖 Jarvis AI"} />
                  </box>
                  <label class="chat-text-label" label={item.text} wrap halign={Gtk.Align.START} />
                </box>
              )}
            </For>
          </box>
        </scrollable>

        <box class="ai-typing-indicator" visible={busy}>
          <label class="typing-text" label={status} />
        </box>

        <box class="ai-input-row" spacing={8}>
          <entry
            $={(self: Gtk.Entry) => (entry = self)}
            class="ai-search-entry"
            hexpand
            placeholderText="Задай вопрос или отдай команду Jarvis (или нажми 🎙️)..."
            onActivate={(self: Gtk.Entry) => submit(self.text)}
          />
          <button class="ai-mic-btn" tooltipText="Запись голоса (микрофон)" onClicked={startVoiceInput}>
            <label label="🎙️" />
          </button>
          <button class="ai-send-btn" onClicked={() => { if (entry) submit(entry.text) }}>
            <label label="Отправить ➔" />
          </button>
        </box>
      </box>
    </window>
  )
}
