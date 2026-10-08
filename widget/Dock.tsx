import app from "ags/gtk3/app"
import { For, createConnection } from "ags"
import { Astal, Gtk, Gdk } from "ags/gtk3"
import Hyprland from "gi://AstalHyprland"
import Gio from "gi://Gio"

function resolveIcon(name: string): Gio.Icon {
  if (!name) return Gio.Icon.new_for_string("application-x-executable")
  if (name.startsWith("/")) {
    return Gio.FileIcon.new(Gio.File.new_for_path(name))
  }
  return Gio.Icon.new_for_string(name)
}

export default function Dock(gdkmonitor: Gdk.Monitor) {
  const hyprland = Hyprland.get_default()

  const sortedClients = () => {
    try {
      return hyprland.get_clients().filter(c => c && c.mapped && c.class).sort((a, b) => (a.class || "").localeCompare(b.class || ""))
    } catch (e) {
      return []
    }
  }

  const clients = createConnection(
    sortedClients(),
    [hyprland, "client-added", sortedClients],
    [hyprland, "client-removed", sortedClients],
  )

  const { LEFT, TOP, BOTTOM } = Astal.WindowAnchor
  const { OVERLAY } = Astal.Layer

  function launchApp(cmd: string) {
    try {
      hyprland.dispatch("exec", cmd)
    } catch (e) {}
  }

  return (
    <window
      name="dock"
      class="UbuntuLeftDockWindow"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      layer={OVERLAY}
      anchor={LEFT | TOP | BOTTOM}
      application={app}
      visible={true}
    >
      <box class="ubuntu-left-dock" vertical halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
        
        {/* 1. App Grid (Ubuntu All Apps Launcher) */}
        <button
          class="dock-item launcher-btn"
          tooltipText="Все приложения (Ubuntu App Grid)"
          onClicked={() => app.toggle_window("launcher")}
        >
          <icon class="dock-app-icon" gicon={resolveIcon("system-file-manager")} pixelSize={32} />
        </button>

        {/* Glass Separator */}
        <box class="glass-separator-h" />

        {/* 2. Pinned Ubuntu Apps */}
        <button
          class="dock-item files-btn"
          tooltipText="Файлы (Nautilus)"
          onClicked={() => launchApp("nautilus")}
        >
          <icon class="dock-app-icon" gicon={resolveIcon("org.gnome.Nautilus")} pixelSize={32} />
        </button>

        <button
          class="dock-item terminal-btn"
          tooltipText="Терминал (Foot)"
          onClicked={() => launchApp("foot")}
        >
          <icon class="dock-app-icon" gicon={resolveIcon("foot")} pixelSize={32} />
        </button>

        <button
          class="dock-item browser-btn"
          tooltipText="Браузер (Brave / Firefox)"
          onClicked={() => launchApp("brave-browser")}
        >
          <icon class="dock-app-icon" gicon={resolveIcon("/snap/brave/current/opt/brave.com/brave/product_logo_128.png")} pixelSize={32} />
        </button>

        <button
          class="dock-item code-btn"
          tooltipText="VS Code"
          onClicked={() => launchApp("code")}
        >
          <icon class="dock-app-icon" gicon={resolveIcon("/snap/code/current/meta/gui/vscode.png")} pixelSize={32} />
        </button>

        <button
          class="dock-item telegram-btn"
          tooltipText="Telegram"
          onClicked={() => launchApp("telegram-desktop")}
        >
          <icon class="dock-app-icon" gicon={resolveIcon("/snap/telegram-desktop/current/meta/gui/icon.png")} pixelSize={32} />
        </button>

        <button
          class="dock-item obsidian-btn"
          tooltipText="Obsidian Vault"
          onClicked={() => launchApp("obsidian")}
        >
          <icon class="dock-app-icon" gicon={resolveIcon("/snap/obsidian/current/meta/gui/obsidian.png")} pixelSize={32} />
        </button>

        <button
          class="dock-item ai-btn"
          tooltipText="Jarvis AI Remote"
          onClicked={() => app.toggle_window("AiWidget")}
        >
          <icon class="dock-app-icon" gicon={resolveIcon("utilities-system-monitor")} pixelSize={32} />
        </button>

        {/* Glass Separator */}
        <box class="glass-separator-h" />

        {/* 3. Running Applications */}
        <For each={clients}>
          {(client) => (
            <button
              class="dock-item active-app-item"
              tooltipText={client.title || client.class || "Приложение"}
              onClicked={() => {
                try { client.focus() } catch (e) {}
              }}
            >
              <box class="active-app-box">
                <box class="active-dot-indicator-left" />
                <icon
                  class="dock-app-icon"
                  pixelSize={32}
                  gicon={resolveIcon(
                    (client.class || "").toLowerCase().includes("obsidian") ? "/snap/obsidian/current/meta/gui/obsidian.png" :
                    (client.class || "").toLowerCase().includes("foot") || (client.class || "").toLowerCase().includes("terminal") || (client.class || "").toLowerCase().includes("kitty") ? "foot" :
                    (client.class || "").toLowerCase().includes("brave") ? "/snap/brave/current/opt/brave.com/brave/product_logo_128.png" :
                    (client.class || "").toLowerCase().includes("firefox") ? "/snap/firefox/current/default256.png" :
                    (client.class || "").toLowerCase().includes("code") ? "/snap/code/current/meta/gui/vscode.png" :
                    (client.class || "").toLowerCase().includes("telegram") ? "/snap/telegram-desktop/current/meta/gui/icon.png" :
                    (client.class || "").toLowerCase().includes("nautilus") ? "org.gnome.Nautilus" :
                    client.class || "application-x-executable"
                  )}
                />
              </box>
            </button>
          )}
        </For>

      </box>
    </window>
  )
}
