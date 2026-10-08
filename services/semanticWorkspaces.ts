import GLib from "gi://GLib"
import Hyprland from "gi://AstalHyprland"
import { callClassify } from "./jarvisClient"
import { getPreferences } from "./preferences"

// §2.3 features_plan.md — во время восстановления сессии (Этап 5, ещё не построен)
// Фича 1 не должна вмешиваться в раскладку окон. Флаг уже здесь заранее — Фича 5
// (Session Restore) просто выставит его при старте, try/finally сбросит.
export const sessionRestore = { active: false }

export function withSessionRestoring<T>(fn: () => Promise<T>): Promise<T> {
  sessionRestore.active = true
  const safetyTimer = setTimeout(() => {
    if (sessionRestore.active) {
      console.warn("[semanticWorkspaces] session restore safety timeout (30s), force-reset")
      sessionRestore.active = false
    }
  }, 30000)
  return fn().finally(() => {
    clearTimeout(safetyTimer)
    sessionRestore.active = false
  })
}

// §2.2 features_plan.md — статическая карта, без обращения к сети.
const STATIC_RULES: Record<string, number> = {
  code: 3,
  firefox: 2,
  "telegram-desktop": 5,
  foot: 3,
  obsidian: 4,
  brave: 2,
  "brave-browser": 2,
}

const CACHE_PATH = GLib.build_filenamev([GLib.get_home_dir(), ".cache/ags/window_class_cache.json"])

function readCache(): Record<string, number> {
  try {
    const [ok, bytes] = GLib.file_get_contents(CACHE_PATH)
    return ok ? JSON.parse(new TextDecoder().decode(bytes)) : {}
  } catch {
    return {}
  }
}

function writeCache(cache: Record<string, number>) {
  try {
    GLib.mkdir_with_parents(GLib.path_get_dirname(CACHE_PATH), 0o755)
    GLib.file_set_contents(CACHE_PATH, JSON.stringify(cache, null, 2))
  } catch (e) {
    console.error("[semanticWorkspaces] failed to write cache:", e)
  }
}

let cache = readCache()
let started = false

export function startSemanticWorkspaces() {
  if (started) return
  started = true

  const { enabled, auto_move } = getPreferences().features.semantic_workspaces
  if (!enabled) return

  const hyprland = Hyprland.get_default()

  hyprland.connect("client-added", async (_hyprland, client) => {
    try {
      if (!client || sessionRestore.active || !auto_move) return

      const cls = client.get_class() || ""
      if (!cls) return

      // 1. Статические правила — 0 мс, без сети.
      if (cls in STATIC_RULES) {
        try { client.move_to(hyprland.get_workspace(STATIC_RULES[cls])) } catch (e) {}
        return
      }

      // 2. Локальный кэш — тоже 0 мс.
      if (cls in cache) {
        try { client.move_to(hyprland.get_workspace(cache[cls])) } catch (e) {}
        return
      }

      // 3. Промах — асинхронный запрос на Hetzner, без блокировки UI.
      try {
        const title = client.get_title ? client.get_title() : ""
        const ws = await callClassify(cls, title)
        cache = { ...cache, [cls]: ws }
        writeCache(cache)
        try { client.move_to(hyprland.get_workspace(ws)) } catch (e) {}
      } catch (e) {
        console.warn("[semanticWorkspaces] classify failed, leaving window in place:", e)
      }
    } catch (err) {
      console.error("[semanticWorkspaces] unhandled error in client-added handler:", err)
    }
  })
}
