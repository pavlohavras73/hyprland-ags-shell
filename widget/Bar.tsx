import app from "ags/gtk3/app"
import { For, createBinding, createConnection, createComputed } from "ags"
import { Astal, Gtk, Gdk } from "ags/gtk3"
import { createPoll } from "ags/time"
import GLib from "gi://GLib"
import Hyprland from "gi://AstalHyprland"
import Battery from "gi://AstalBattery"
import { ramState, ramAvailableMb } from "../services/ramGuardian"
import { batteryInfo } from "../services/batteryGuardian"

function LauncherButton() {
  return (
    <button
      class="bar-pill-btn LauncherButton"
      tooltipText="Лаунчер приложений (Super+D)"
      onClicked={() => app.toggle_window("launcher")}
    >
      <label class="bar-btn-icon" label="🎛️" />
    </button>
  )
}

function CheatsheetButton() {
  return (
    <button
      class="bar-pill-btn CheatsheetButton"
      tooltipText="Горячие клавиши (Super+/)"
      onClicked={() => app.toggle_window("cheatsheet")}
    >
      <label class="bar-btn-icon" label="⌨️" />
    </button>
  )
}

function CommandPaletteButton() {
  return (
    <button
      class="bar-pill-btn CommandPaletteButton"
      tooltipText="Командная палитра (Super+K)"
      onClicked={() => app.toggle_window("command-palette")}
    >
      <label class="bar-btn-icon" label="⚡" />
    </button>
  )
}

function AiWidgetButton() {
  return (
    <button
      class="bar-pill-btn AiWidgetButton"
      tooltipText="Jarvis AI (Super+A)"
      onClicked={() => app.toggle_window("AiWidget")}
    >
      <label class="bar-btn-icon" label="🤖" />
    </button>
  )
}

function Workspaces() {
  const hyprland = Hyprland.get_default()
  const sorted = () => hyprland.get_workspaces().sort((a, b) => a.id - b.id)

  const workspaces = createConnection(
    sorted(),
    [hyprland, "workspace-added", sorted],
    [hyprland, "workspace-removed", sorted],
  )

  const focusedWorkspace = createBinding(hyprland, "focusedWorkspace")

  return (
    <box class="bar-pill-container Workspaces">
      <For each={workspaces}>
        {(ws) => (
          <button
            class={focusedWorkspace((focused) =>
              focused && focused.id === ws.id ? "workspace-btn focused" : "workspace-btn",
            )}
            onClicked={() => ws.focus()}
          >
            <label label={String(ws.id)} />
          </button>
        )}
      </For>
    </box>
  )
}

function Clock() {
  const time = createPoll("", 60000, () =>
    GLib.DateTime.new_now_local().format("🕒 %H:%M  •  %a %d %b") ?? "",
  )

  return (
    <box class="bar-pill-container Clock">
      <label label={time} />
    </box>
  )
}

function BatteryIndicator() {
  const battery = Battery.get_default()
  const percent = createBinding(battery, "percentage")
  const charging = createBinding(battery, "charging")
  const isPresent = createBinding(battery, "isPresent")

  const label = createComputed(
    () => `${charging() ? "⚡" : "🔋"} ${Math.round(percent() * 100)}%`,
  )

  return (
    <box class="bar-pill-container Battery" visible={isPresent}>
      <label label={label} />
    </box>
  )
}

function RamIndicator() {
  const label = createComputed(() => `🧠 RAM: ${Math.round(ramAvailableMb())} МБ`)

  return (
    <box class={ramState((s) => `bar-pill-container Ram Ram-${s}`)} visible={ramState((s) => s !== "ok")}>
      <label label={label} />
    </box>
  )
}

function QuickSettingsButton() {
  const label = batteryInfo((info) => {
    if (!info.isBattery) return "⚡ 100% ⏻"
    return `⚙️ ${info.charging ? "⚡" : "🔋"} ${info.percent}% ⏻`
  })

  return (
    <button
      class="bar-pill-container system-qs-btn"
      tooltipText="Панель управления Ubuntu (Громкость, Яркость, Питание)"
      onClicked={() => app.toggle_window("quick-settings")}
    >
      <label label={label} />
    </button>
  )
}

export default function Bar(gdkmonitor: Gdk.Monitor) {
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

  return (
    <window
      class="Bar"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      anchor={TOP | LEFT | RIGHT}
      application={app}
    >
      <centerbox class="bar-centerbox">
        <box $type="start" class="bar-start-box">
          <LauncherButton />
          <CommandPaletteButton />
          <AiWidgetButton />
          <Workspaces />
        </box>
        
        <Clock $type="center" />

        <box $type="end" class="bar-end-box">
          <RamIndicator />
          <QuickSettingsButton />
          <CheatsheetButton />
        </box>
      </centerbox>
    </window>
  )
}
