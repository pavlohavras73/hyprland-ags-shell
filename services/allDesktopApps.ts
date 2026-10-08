import Apps from "gi://AstalApps"
import Gio from "gi://Gio"
import GLib from "gi://GLib"
import { execAsync } from "ags/process"

export interface CustomApp {
  id: string
  name: string
  description: string
  gicon: Gio.Icon
  launch: () => void
}

export function getAllDesktopApps(): CustomApp[] {
  const astalApps = new Apps.Apps()
  const list: CustomApp[] = []
  const seenIds = new Set<string>()

  // 1. Standard Astal Apps list
  try {
    const rawApps = astalApps.get_list()
    for (let i = 0; i < rawApps.length; i++) {
      const app = rawApps[i]
      if (!app) continue
      const name = app.name || app.get_name()
      if (!name) continue
      const id = (app.entry || name).toLowerCase()
      if (seenIds.has(id)) continue
      seenIds.add(id)

      const iconName = app.iconName || app.icon_name || ""
      const gicon = iconName.startsWith("/")
        ? Gio.FileIcon.new(Gio.File.new_for_path(iconName))
        : Gio.Icon.new_for_string(iconName || "application-x-executable")

      list.push({
        id,
        name: String(name),
        description: String(app.description || ""),
        gicon,
        launch: () => app.launch(),
      })
    }
  } catch (e) {}

  // 2. Additional Ubuntu GNOME System Apps (Settings, Tweaks, Terminal, Power Stats, etc.)
  const extraDesktops = [
    "org.gnome.Settings.desktop",
    "org.gnome.tweaks.desktop",
    "org.gnome.Terminal.desktop",
    "org.gnome.PowerStats.desktop",
    "gnome-session-properties.desktop",
    "yelp.desktop",
    "com.mattjakeman.ExtensionManager.desktop",
    "im-config.desktop",
  ]

  for (let i = 0; i < extraDesktops.length; i++) {
    const file = extraDesktops[i]
    try {
      const info = Gio.DesktopAppInfo.new(file)
      if (info) {
        const name = info.get_name()
        if (name) {
          const id = file.toLowerCase()
          if (!seenIds.has(id) && !seenIds.has(name.toLowerCase())) {
            seenIds.add(id)
            seenIds.add(name.toLowerCase())
            const gicon = info.get_icon() || Gio.Icon.new_for_string("application-x-executable")
            list.push({
              id,
              name: String(name),
              description: String(info.get_description() || ""),
              gicon,
              launch: () => {
                try {
                  execAsync(["gtk-launch", file]).catch(() => info.launch([], null))
                } catch (err) {
                  const cmd = info.get_executable() || info.get_commandline()
                  if (cmd) GLib.spawn_command_line_async(cmd)
                }
              },
            })
          }
        }
      }
    } catch (e) {}
  }

  list.sort((a, b) => a.name.localeCompare(b.name, "ru"))
  return list
}
