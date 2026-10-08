import GLib from "gi://GLib"

export interface Preferences {
  server_url: string
  features: {
    semantic_workspaces: { enabled: boolean; auto_move: boolean }
    command_palette: { enabled: boolean }
    day_chronicle: { enabled: boolean; idle_timeout_min: number }
    ram_guardian: {
      enabled: boolean
      warn_threshold_mb: number
      alert_threshold_mb: number
      emergency_threshold_mb: number
    }
    telegram_bridge: {
      enabled: boolean
      connection_mode: string
      long_poll_timeout_sec: number
    }
  }
}

let cached: Preferences | null = null

export function getPreferences(): Preferences {
  if (!cached) {
    try {
      const path = GLib.build_filenamev([GLib.get_home_dir(), ".config/ags/preferences.json"])
      const [ok, bytes] = GLib.file_get_contents(path)
      if (!ok) throw new Error("preferences.json not found")
      cached = JSON.parse(new TextDecoder().decode(bytes))
    } catch (e) {
      console.error("[preferences] failed to load, using defaults:", e)
      cached = {
        server_url: "",
        features: {
          semantic_workspaces: { enabled: false, auto_move: false },
          command_palette: { enabled: false },
          day_chronicle: { enabled: false, idle_timeout_min: 5 },
          ram_guardian: {
            enabled: true,
            warn_threshold_mb: 1600,
            alert_threshold_mb: 1200,
            emergency_threshold_mb: 600,
          },
          telegram_bridge: { enabled: false, connection_mode: "long_polling", long_poll_timeout_sec: 60 },
        },
      }
    }
  }
  return cached as Preferences
}
