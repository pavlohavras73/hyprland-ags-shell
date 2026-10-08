import app from "ags/gtk3/app"
import { createState, For } from "ags"
import { Astal, Gtk } from "ags/gtk3"
import { ramState } from "../services/ramGuardian"
import { getTopProcesses, killProcess, type TopProcess } from "../services/ramGuardian"

const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor

export default function RamEmergency() {
  const [procs, setProcs] = createState(new Array<TopProcess>())

  ramState.subscribe(() => {
    if (ramState.get() === "emergency") {
      getTopProcesses(3).then(setProcs)
    }
  })

  const visible = ramState((s) => s === "emergency")

  return (
    <window
      name="ram-emergency"
      class="RamEmergency"
      visible={visible}
      application={app}
      anchor={TOP | BOTTOM | LEFT | RIGHT}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.EXCLUSIVE}
      onNotifyVisible={(self: Astal.Window) => {
        if (self.visible) self.show_all()
      }}
    >
      <box
        class="ram-emergency-content"
        vertical
        halign={Gtk.Align.CENTER}
        valign={Gtk.Align.CENTER}
      >
        <label class="ram-emergency-title" label="⚠ Критически мало памяти" />
        <label
          class="ram-emergency-desc"
          label="Закройте один из процессов ниже, чтобы освободить RAM"
          wrap
        />
        <box vertical>
          <For each={procs}>
            {(p) => (
              <box class="ram-emergency-row">
                <label
                  label={`${p.comm} — ${Math.round(p.rssMb)} МБ`}
                  halign={Gtk.Align.START}
                  hexpand
                />
                <button onClicked={() => killProcess(p.pid)}>
                  <label label="Закрыть (SIGTERM)" />
                </button>
              </box>
            )}
          </For>
        </box>
      </box>
    </window>
  )
}
