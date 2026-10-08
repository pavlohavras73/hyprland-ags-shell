import GLib from "gi://GLib"
import Gio from "gi://Gio"
import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import app from "ags/gtk3/app"
import { getPreferences, type Preferences } from "./preferences"

export type RamState = "ok" | "warn" | "alert" | "emergency"

export type RamThresholds = Preferences["features"]["ram_guardian"]

export interface TopProcess {
  pid: number
  rssMb: number
  comm: string
}

function readMemAvailableMb(): number {
  const [ok, bytes] = GLib.file_get_contents("/proc/meminfo")
  if (!ok) return 0
  const text = new TextDecoder().decode(bytes)
  const match = text.match(/MemAvailable:\s+(\d+) kB/)
  return match ? parseInt(match[1], 10) / 1024 : 0
}

// Формула §5.1 features_plan.md. Без активного zram (zram0 отсутствует на этой
// машине — Фаза 6 ещё не сделана) вклад zram-члена корректно вырождается в 0,
// EffectiveAvailableMB совпадает с MemAvailable.
function readNum(path: string): number {
  const [ok, bytes] = GLib.file_get_contents(path)
  return ok ? parseInt(new TextDecoder().decode(bytes).trim(), 10) : 0
}

function readEffectiveAvailableMb(): number {
  const memAvailable = readMemAvailableMb()
  try {
    if (!GLib.file_test("/sys/block/zram0/disksize", GLib.FileTest.EXISTS)) {
      return memAvailable
    }

    const diskMb = readNum("/sys/block/zram0/disksize") / (1024 * 1024)

    // mm_stat: "orig_data_size compr_data_size mem_used_total ..."
    const [ok, bytes] = GLib.file_get_contents("/sys/block/zram0/mm_stat")
    if (!ok) return memAvailable
    const [origDataSize, comprDataSize] = new TextDecoder()
      .decode(bytes)
      .trim()
      .split(/\s+/)
      .map(Number)
    const origMb = origDataSize / (1024 * 1024)
    const comprMb = comprDataSize / (1024 * 1024)
    if (comprMb === 0) return memAvailable

    return memAvailable + (diskMb - origMb) * (origMb / comprMb)
  } catch {
    return memAvailable
  }
}

export function readPsiMemorySomeAvg10(): number {
  try {
    const [ok, bytes] = GLib.file_get_contents("/proc/pressure/memory")
    if (!ok) return 0
    const text = new TextDecoder().decode(bytes)
    const match = text.match(/some\s+avg10=([\d.]+)/)
    return match ? parseFloat(match[1]) : 0
  } catch {
    return 0
  }
}

function stateFor(availableMb: number, t: RamThresholds): RamState {
  const psiAvg10 = readPsiMemorySomeAvg10()
  if (availableMb <= t.emergency_threshold_mb || psiAvg10 > 15) return "emergency"
  if (availableMb <= t.alert_threshold_mb) return "alert"
  if (availableMb <= t.warn_threshold_mb) return "warn"
  return "ok"
}

export async function getTopProcesses(count = 3): Promise<TopProcess[]> {
  const out = await execAsync(["ps", "-eo", "pid,rss,comm", "--sort=-rss", "--no-headers"])
  return out
    .split("\n")
    .slice(0, count)
    .filter(Boolean)
    .map((line) => {
      const [pid, rss, ...commParts] = line.trim().split(/\s+/)
      return { pid: parseInt(pid, 10), rssMb: parseInt(rss, 10) / 1024, comm: commParts.join(" ") }
    })
}

export function killProcess(pid: number) {
  try {
    GLib.spawn_command_line_async(`kill -TERM ${pid}`)
  } catch (e) {
    console.error("[ramGuardian] failed to kill", pid, e)
  }
}

// Регистрируем app-action один раз — уведомление шлёт "app.ram-guardian-kill-top",
// mako рендерит кнопку, клик по ней вызывает это действие через D-Bus.
let actionRegistered = false
function ensureKillAction() {
  if (actionRegistered) return
  actionRegistered = true
  const action = new Gio.SimpleAction({ name: "ram-guardian-kill-top" })
  action.connect("activate", async () => {
    const [top] = await getTopProcesses(1)
    if (top) killProcess(top.pid)
  })
  app.add_action(action)
}

let lastNotifiedState: RamState = "ok"

async function notifyIfNeeded(state: RamState, availableMb: number) {
  if (state === lastNotifiedState) return
  lastNotifiedState = state

  if (state === "alert") {
    ensureKillAction()
    const top = await getTopProcesses(3)
    const notification = new Gio.Notification()
    notification.set_title("RAM: критический дефицит")
    notification.set_body(
      `Доступно ${Math.round(availableMb)} МБ.\nТоп: ${top.map((p) => `${p.comm} (${Math.round(p.rssMb)} МБ)`).join(", ")}`,
    )
    notification.set_priority(Gio.NotificationPriority.URGENT)
    notification.add_button("Закрыть процесс", "app.ram-guardian-kill-top")
    app.send_notification("ram-guardian-alert", notification)
  }
}

const thresholds = getPreferences().features.ram_guardian

export const ramState = createPoll<RamState>("ok", 8000, (prev) => {
  const availableMb = readEffectiveAvailableMb()
  const state = stateFor(availableMb, thresholds)
  notifyIfNeeded(state, availableMb)
  return state
})

export const ramAvailableMb = createPoll<number>(0, 8000, () => readEffectiveAvailableMb())

export { thresholds as ramThresholds }
