import app from "ags/gtk3/app"
import { createState } from "ags"
import { Astal, Gtk, Gdk } from "ags/gtk3"
import { execAsync } from "ags/process"
import Gio from "gi://Gio"
import GLib from "gi://GLib"
import { batteryInfo } from "../services/batteryGuardian"

const { TOP, RIGHT } = Astal.WindowAnchor

function safeIcon(primaryName: string, fallbackName = "preferences-system"): Gio.Icon {
  try {
    const theme = Gtk.IconTheme.get_default()
    if (primaryName.startsWith("/")) {
      return Gio.FileIcon.new(Gio.File.new_for_path(primaryName))
    }
    if (theme.has_icon(primaryName)) {
      return Gio.Icon.new_for_string(primaryName)
    }
    if (theme.has_icon(fallbackName)) {
      return Gio.Icon.new_for_string(fallbackName)
    }
  } catch (e) {}
  return Gio.Icon.new_for_string("preferences-system")
}

function getUptimeString(): string {
  try {
    const [ok, bytes] = GLib.file_get_contents("/proc/uptime")
    if (!ok) return "Аптайм: 0 мин"
    const secs = parseFloat(new TextDecoder().decode(bytes).split(" ")[0])
    const hrs = Math.floor(secs / 3600)
    const mins = Math.floor((secs % 3600) / 60)
    if (hrs > 0) return `Аптайм: ${hrs} ч ${mins} мин`
    return `Аптайм: ${mins} мин`
  } catch {
    return "Аптайм: 0 мин"
  }
}

export default function QuickSettings() {
  let win: Astal.Window

  const battLabel = batteryInfo((info) => {
    if (!info.isBattery) return "⚡ Питание от сети (100%)"
    return `${info.charging ? "⚡ Зарядка" : "🔋 Батарея"}: ${info.percent}%`
  })

  const [volLevel, setVolLevel] = createState(80)
  const [isMuted, setIsMuted] = createState(false)
  const [brightLevel, setBrightLevel] = createState(100)
  const [micMuted, setMicMuted] = createState(false)
  const [uptimeStr, setUptimeStr] = createState(getUptimeString())

  // Refresh Volume
  async function refreshVolume() {
    try {
      const out = await execAsync(["wpctl", "get-volume", "@DEFAULT_AUDIO_SINK@"])
      const match = out.match(/Volume:\s+([\d.]+)/)
      if (match) {
        const raw = parseFloat(match[1])
        const pct = Math.min(100, Math.max(0, Math.round(raw <= 1.0 ? raw * 100 : raw)))
        setVolLevel(pct)
      }
      setIsMuted(out.includes("[MUTED]"))
    } catch (e) {}
  }

  // Refresh Brightness
  async function refreshBrightness() {
    try {
      const curStr = await execAsync(["brightnessctl", "g"])
      const maxStr = await execAsync(["brightnessctl", "m"])
      const cur = parseInt(curStr.trim(), 10)
      const max = parseInt(maxStr.trim(), 10)
      if (max > 0) {
        setBrightLevel(Math.min(100, Math.max(1, Math.round((cur / max) * 100))))
      }
    } catch (e) {}
  }

  function changeVolume(val: number) {
    const level = Math.max(0, Math.min(100, Math.round(val <= 1.0 && val > 0 ? val * 100 : val)))
    setVolLevel(level)
    execAsync(["wpctl", "set-volume", "@DEFAULT_AUDIO_SINK@", `${level}%`]).catch(() => {})
  }

  function toggleMute() {
    execAsync(["wpctl", "set-mute", "@DEFAULT_AUDIO_SINK@", "toggle"])
      .then(() => refreshVolume())
      .catch(() => {})
  }

  function changeBrightness(val: number) {
    const level = Math.max(1, Math.min(100, Math.round(val <= 1.0 && val > 0 ? val * 100 : val)))
    setBrightLevel(level)
    execAsync(["brightnessctl", "set", `${level}%`]).catch(() => {})
  }

  function toggleMicMute() {
    execAsync(["wpctl", "set-mute", "@DEFAULT_AUDIO_SOURCE@", "toggle"])
      .then(() => setMicMuted(!micMuted()))
      .catch(() => {})
  }

  function systemPower(action: "lock" | "suspend" | "reboot" | "shutdown" | "exit") {
    if (win) win.visible = false
    switch (action) {
      case "lock":
        execAsync(["loginctl", "lock-session"]).catch(() => execAsync(["hyprlock"]))
        break
      case "suspend":
        execAsync(["systemctl", "suspend"])
        break
      case "reboot":
        execAsync(["systemctl", "reboot"])
        break
      case "shutdown":
        execAsync(["systemctl", "poweroff"])
        break
      case "exit":
        execAsync(["hyprctl", "dispatch", "exit"])
        break
    }
  }

  return (
    <window
      $={(self: Astal.Window) => (win = self)}
      name="quick-settings"
      class="QuickSettingsWindow"
      visible={false}
      application={app}
      anchor={TOP | RIGHT}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.EXCLUSIVE}
      onNotifyVisible={(self: Astal.Window) => {
        if (self.visible) {
          self.show_all()
          refreshVolume()
          refreshBrightness()
          setUptimeStr(getUptimeString())
        }
      }}
      onKeyPressEvent={(self, e) => {
        const event = e as unknown as Gdk.Event
        if (event.get_keyval()[1] === Gdk.KEY_Escape) {
          self.visible = false
        }
      }}
    >
      <box class="quick-settings-card" vertical spacing={14}>
        
        {/* Header / User Card */}
        <box class="qs-header-card" spacing={12} valign={Gtk.Align.CENTER}>
          <box class="qs-avatar-wrapper">
            <icon class="qs-user-avatar" gicon={safeIcon("avatar-default", "user-info")} pixelSize={38} />
          </box>
          <box vertical valign={Gtk.Align.CENTER} expand>
            <label class="qs-user-name" label="Rainar" halign={Gtk.Align.START} />
            <label class="qs-host-subtitle" label={battLabel} halign={Gtk.Align.START} />
            <label class="qs-uptime-label" label={uptimeStr} halign={Gtk.Align.START} />
          </box>
          <button class="qs-close-btn" onClicked={() => { if (win) win.visible = false }}>
            <label label="✕" />
          </button>
        </box>

        {/* Separator */}
        <box class="qs-divider" />

        {/* Sliders Area */}
        <box class="qs-sliders-box" vertical spacing={12}>
          
          {/* Volume Control */}
          <box class="qs-slider-row" spacing={12} valign={Gtk.Align.CENTER}>
            <button class="qs-slider-icon-btn" onClicked={toggleMute} tooltipText="Отключить/включить звук">
              <icon gicon={safeIcon(isMuted() ? "audio-volume-muted" : "audio-volume-high", "audio-volume-high")} pixelSize={24} />
            </button>
            <slider
              class="qs-slider"
              hexpand
              min={0}
              max={100}
              value={volLevel()}
              onValueChanged={(self: Gtk.Scale) => changeVolume(self.value)}
            />
            <label class="qs-slider-val" label={volLevel((v) => `${v}%`)} />
          </box>

          {/* Brightness Control */}
          <box class="qs-slider-row" spacing={12} valign={Gtk.Align.CENTER}>
            <icon class="qs-slider-icon" gicon={safeIcon("preferences-desktop-display", "preferences-system")} pixelSize={24} />
            <slider
              class="qs-slider"
              hexpand
              min={1}
              max={100}
              value={brightLevel()}
              onValueChanged={(self: Gtk.Scale) => changeBrightness(self.value)}
            />
            <label class="qs-slider-val" label={brightLevel((b) => `${b}%`)} />
          </box>

        </box>

        {/* Quick Toggles 2x2 Grid */}
        <box class="qs-grid" spacing={10} homogeneous>
          <button class={micMuted((m) => `qs-toggle-tile ${m ? "inactive" : "active"}`)} onClicked={toggleMicMute}>
            <box spacing={10} valign={Gtk.Align.CENTER}>
              <icon gicon={safeIcon("audio-headset", "preferences-system")} pixelSize={24} />
              <box vertical valign={Gtk.Align.CENTER}>
                <label class="qs-tile-title" label="Микрофон" halign={Gtk.Align.START} />
                <label class="qs-tile-sub" label={micMuted() ? "Выключен" : "Включён"} halign={Gtk.Align.START} />
              </box>
            </box>
          </button>

          <button class="qs-toggle-tile active" onClicked={() => execAsync(["nm-connection-editor"]).catch(() => {})}>
            <box spacing={10} valign={Gtk.Align.CENTER}>
              <icon gicon={safeIcon("preferences-system-network", "network-workgroup")} pixelSize={24} />
              <box vertical valign={Gtk.Align.CENTER}>
                <label class="qs-tile-title" label="Сеть Wi-Fi" halign={Gtk.Align.START} />
                <label class="qs-tile-sub" label="Подключено" halign={Gtk.Align.START} />
              </box>
            </box>
          </button>
        </box>

        {/* Separator */}
        <box class="qs-divider" />

        {/* System Power Controls Title */}
        <label class="qs-power-section-title" label="Управление питанием и сеансом" halign={Gtk.Align.START} />

        {/* System Power Actions Grid */}
        <box class="qs-power-grid" spacing={8} homogeneous>
          
          <button class="qs-power-tile lock" tooltipText="Заблокировать экран (Hyprlock)" onClicked={() => systemPower("lock")}>
            <box vertical halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} spacing={6}>
              <icon gicon={safeIcon("system-lock-screen", "preferences-system")} pixelSize={24} />
              <label class="qs-power-name" label="Блокировка" />
            </box>
          </button>

          <button class="qs-power-tile suspend" tooltipText="Спящий режим (Suspend)" onClicked={() => systemPower("suspend")}>
            <box vertical halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} spacing={6}>
              <icon gicon={safeIcon("preferences-system", "preferences-system")} pixelSize={24} />
              <label class="qs-power-name" label="Спящий режим" />
            </box>
          </button>

          <button class="qs-power-tile exit" tooltipText="Выйти из Hyprland" onClicked={() => systemPower("exit")}>
            <box vertical halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} spacing={6}>
              <icon gicon={safeIcon("system-log-out", "preferences-system")} pixelSize={24} />
              <label class="qs-power-name" label="Выход" />
            </box>
          </button>

          <button class="qs-power-tile reboot" tooltipText="Перезагрузить систему" onClicked={() => systemPower("reboot")}>
            <box vertical halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} spacing={6}>
              <icon gicon={safeIcon("system-reboot", "preferences-system")} pixelSize={24} />
              <label class="qs-power-name" label="Перезагрузка" />
            </box>
          </button>

          <button class="qs-power-tile shutdown" tooltipText="Выключить компьютер" onClicked={() => systemPower("shutdown")}>
            <box vertical halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} spacing={6}>
              <icon gicon={safeIcon("system-shutdown", "preferences-system")} pixelSize={24} />
              <label class="qs-power-name" label="Выключение" />
            </box>
          </button>

        </box>

      </box>
    </window>
  )
}
