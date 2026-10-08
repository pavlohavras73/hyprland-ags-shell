import app from "ags/gtk3/app"
import { createState } from "ags"
import { Astal, Gdk, Gtk } from "ags/gtk3"
import { setPowerConfirmation } from "../services/dispatcher"

const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor

const LABELS: Record<string, string> = {
  reboot: "Перезагрузить компьютер?",
  shutdown: "Выключить компьютер?",
}

export default function PowerConfirm() {
  const [visible, setVisible] = createState(false)
  const [mode, setMode] = createState<"reboot" | "shutdown">("reboot")
  let resolve: ((v: boolean) => void) | null = null

  setPowerConfirmation((m) => {
    setMode(m)
    setVisible(true)
    return new Promise<boolean>((res) => {
      resolve = res
    })
  })

  function answer(v: boolean) {
    setVisible(false)
    resolve?.(v)
    resolve = null
  }

  return (
    <window
      name="power-confirm"
      class="PowerConfirm"
      visible={visible}
      application={app}
      anchor={TOP | BOTTOM | LEFT | RIGHT}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.EXCLUSIVE}
      onNotifyVisible={(self: Astal.Window) => {
        if (self.visible) self.show_all()
      }}
      onKeyPressEvent={(self, e) => {
        const event = e as unknown as Gdk.Event
        if (event.get_keyval()[1] === Gdk.KEY_Escape) answer(false)
      }}
    >
      <box
        class="power-confirm-content"
        vertical
        halign={Gtk.Align.CENTER}
        valign={Gtk.Align.CENTER}
      >
        <label class="power-confirm-title" label={mode((m) => LABELS[m])} />
        <label
          class="power-confirm-desc"
          label="Команда пришла через голосовой/текстовый ввод — требуется подтверждение"
          wrap
        />
        <box class="power-confirm-buttons" halign={Gtk.Align.CENTER}>
          <button onClicked={() => answer(false)}>
            <label label="Отмена" />
          </button>
          <button class="power-confirm-danger" onClicked={() => answer(true)}>
            <label label="Подтвердить" />
          </button>
        </box>
      </box>
    </window>
  )
}
