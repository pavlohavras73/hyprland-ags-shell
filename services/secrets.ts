import GLib from "gi://GLib"

let cached: Record<string, string> | null = null

// secrets.json — намеренно НЕ в git (~/.cfg/info/exclude), см. features_plan.md §7
export function getSecret(key: string): string | null {
  if (!cached) {
    try {
      const path = GLib.build_filenamev([GLib.get_home_dir(), ".config/ags/secrets.json"])
      const [ok, bytes] = GLib.file_get_contents(path)
      cached = ok ? JSON.parse(new TextDecoder().decode(bytes)) : {}
    } catch {
      cached = {}
    }
  }
  return (cached as Record<string, string>)[key] ?? null
}
