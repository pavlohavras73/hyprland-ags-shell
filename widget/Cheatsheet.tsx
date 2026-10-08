import app from "ags/gtk3/app"
import { Astal, Gdk, Gtk } from "ags/gtk3"

const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor

interface CategoryGroup {
  category: string
  icon: string
  binds: [string, string][]
}

const CATEGORIES: CategoryGroup[] = [
  {
    category: "Навигация & Окна",
    icon: "🚀",
    binds: [
      ["Super + 1..9", "Перейти на воркспейс"],
      ["Super + Shift + 1..9", "Перенести окно на воркспейс"],
      ["Super + ← ↑ → ↓", "Переключить фокус"],
      ["Super + F", "Fullscreen режим"],
      ["Super + V", "Floating режим"],
      ["Super + C", "Закрыть окно"],
    ],
  },
  {
    category: "Приложения & ИИ",
    icon: "🛠️",
    binds: [
      ["Super + Q", "Терминал"],
      ["Super + D", "Лаунчер приложений"],
      ["Super + K", "Командная палитра"],
      ["Super + A", "Jarvis AI"],
      ["Super + E", "Файловый менеджер"],
      ["Super + /", "Шпаргалка"],
    ],
  },
  {
    category: "Система & Горячие клавиши",
    icon: "⚙️",
    binds: [
      ["Print", "Снимок экрана"],
      ["Shift + Print", "Выделить область снимка"],
      ["Боковая кнопка мыши", "История буфера обмена"],
      ["Super + Shift + W", "Тема Material You по обоям"],
      ["Super + Shift + R", "Сброс на дефолт (Black & Red)"],
      ["Super + Shift + E", "Выход из системы"],
    ],
  },
]

export default function Cheatsheet() {
  let win: Astal.Window
  let closeBtn: Gtk.Button

  return (
    <window
      $={(self: Astal.Window) => (win = self)}
      name="cheatsheet"
      class="Cheatsheet"
      visible={false}
      application={app}
      anchor={TOP | BOTTOM | LEFT | RIGHT}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.EXCLUSIVE}
      onNotifyVisible={(self: Astal.Window) => {
        if (self.visible) {
          self.show_all()
          if (closeBtn) closeBtn.grab_focus()
        }
      }}
      onKeyPressEvent={(self, e) => {
        const event = e as unknown as Gdk.Event
        const [, keyval] = event.get_keyval()
        if (keyval === Gdk.KEY_Escape) {
          self.visible = false
        }
      }}
      onButtonPressEvent={(self: Astal.Window) => {
        self.visible = false
      }}
    >
      <box
        class="cheatsheet-card-container"
        vertical
        halign={Gtk.Align.CENTER}
        valign={Gtk.Align.CENTER}
        onButtonPressEvent={() => true}
      >
        <box class="cheatsheet-header">
          <label class="cheatsheet-icon-badge" label="⌨️" />
          <label class="cheatsheet-title" label="Шпаргалка горячих клавиш Jarvis OS" />
          <box hexpand />
          <button
            $={(self: Gtk.Button) => (closeBtn = self)}
            class="cheatsheet-close-btn"
            onClicked={() => { if (win) win.visible = false }}
          >
            <label label="✕" />
          </button>
        </box>

        <box class="cheatsheet-grid" spacing={16}>
          {CATEGORIES.map((cat) => (
            <box vertical class="cheatsheet-category-card" hexpand>
              <box class="category-header">
                <label class="category-icon" label={cat.icon} />
                <label class="category-title" label={cat.category} />
              </box>
              <box vertical class="category-binds-list">
                {cat.binds.map(([keys, desc]) => (
                  <box class="bind-row">
                    <label class="key-badge" label={keys} halign={Gtk.Align.START} />
                    <label class="bind-desc" label={desc} halign={Gtk.Align.END} hexpand ellipsize={3} />
                  </box>
                ))}
              </box>
            </box>
          ))}
        </box>
      </box>
    </window>
  )
}
