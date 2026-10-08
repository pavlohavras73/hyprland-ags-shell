import GLib from "gi://GLib"
import { execAsync } from "ags/process"
import Hyprland from "gi://AstalHyprland"
import type { WhitelistAction } from "./jarvisClient"

// §1.2 + §3.3 features_plan.md — Action Whitelist Dispatcher. Единственная точка
// исполнения команд. Сервер уже валидирует форму запроса, но клиент — граница,
// за которой начинается реальное выполнение на системе, поэтому проверяем заново
// и не доверяем слепо тому, что пришло по сети.

const LAUNCH_APPS: Record<string, string> = {
  code: "code",
  firefox: "firefox",
  foot: "foot",
  obsidian: "obsidian",
  telegram: "telegram-desktop",
}

const POWER_MODES = ["lock", "suspend", "reboot", "shutdown"] as const
type PowerMode = (typeof POWER_MODES)[number]

// lock/suspend — низкий риск, обратимо, выполняем сразу.
// reboot/shutdown — прерывает работу пользователя без возможности отмены,
// требуем подтверждение через onConfirmPower, а не выполняем вслепую по
// одному только тому, что LLM разобрал текстовую команду.
export type ConfirmPowerFn = (mode: "reboot" | "shutdown") => Promise<boolean>

let confirmPower: ConfirmPowerFn = async () => false
export function setPowerConfirmation(fn: ConfirmPowerFn) {
  confirmPower = fn
}

function isValid(a: WhitelistAction): boolean {
  switch (a.action) {
    case "focus_workspace":
    case "move_window_to_workspace":
      return typeof a.args.index === "number" && a.args.index >= 1 && a.args.index <= 10
    case "launch_app":
      return typeof a.args.app_name === "string" && a.args.app_name in LAUNCH_APPS
    case "set_volume":
    case "set_brightness":
      return typeof a.args.level === "number" && a.args.level >= 0 && a.args.level <= 100
    case "query_jarvis_brain":
      return typeof a.args.query === "string" && a.args.query.length > 0
    case "system_power":
      return (
        typeof a.args.mode === "string" && (POWER_MODES as readonly string[]).includes(a.args.mode)
      )
    default:
      return false
  }
}

export interface DispatchResult {
  action: string
  ok: boolean
  detail?: string
}

async function execute(a: WhitelistAction): Promise<DispatchResult> {
  const hyprland = Hyprland.get_default()

  switch (a.action) {
    case "focus_workspace": {
      hyprland.dispatch("workspace", String(a.args.index))
      return { action: a.action, ok: true }
    }
    case "move_window_to_workspace": {
      hyprland.dispatch("movetoworkspacesilent", String(a.args.index))
      return { action: a.action, ok: true }
    }
    case "launch_app": {
      const bin = LAUNCH_APPS[a.args.app_name as string]
      GLib.spawn_command_line_async(bin)
      return { action: a.action, ok: true }
    }
    case "set_volume": {
      await execAsync(["wpctl", "set-volume", "@DEFAULT_AUDIO_SINK@", `${a.args.level}%`])
      return { action: a.action, ok: true }
    }
    case "set_brightness": {
      await execAsync(["brightnessctl", "set", `${a.args.level}%`])
      return { action: a.action, ok: true }
    }
    case "query_jarvis_brain": {
      // Хроника дня / база знаний — Этап 5, ещё не построен.
      return { action: a.action, ok: false, detail: "query_jarvis_brain пока не реализован (Этап 5)" }
    }
    case "system_power": {
      const mode = a.args.mode as PowerMode
      if (mode === "lock") {
        await execAsync(["loginctl", "lock-session"])
        return { action: a.action, ok: true }
      }
      if (mode === "suspend") {
        await execAsync(["systemctl", "suspend"])
        return { action: a.action, ok: true }
      }
      // reboot / shutdown — обязательное подтверждение
      const confirmed = await confirmPower(mode)
      if (!confirmed) {
        return { action: a.action, ok: false, detail: "Отменено пользователем" }
      }
      await execAsync(["systemctl", mode])
      return { action: a.action, ok: true }
    }
    default:
      return { action: a.action, ok: false, detail: "Неизвестное действие" }
  }
}

export async function dispatch(actions: WhitelistAction[]): Promise<DispatchResult[]> {
  const results: DispatchResult[] = []
  for (const a of actions) {
    if (!a || !a.action || !isValid(a)) {
      results.push({ action: a?.action ?? "?", ok: false, detail: "Отклонено whitelist'ом" })
      continue
    }
    try {
      results.push(await execute(a))
    } catch (e) {
      results.push({ action: a.action, ok: false, detail: String(e) })
    }
  }
  return results
}
