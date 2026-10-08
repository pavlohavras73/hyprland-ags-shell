import { fetch, Response } from "ags/fetch"
import { getPreferences } from "./preferences"
import { getSecret } from "./secrets"

export interface WhitelistAction {
  action: string
  args: Record<string, unknown>
}

export class JarvisClientError extends Error {
  constructor(
    message: string,
    public readonly kind: "transport" | "auth" | "parse" | "config",
  ) {
    super(message)
  }
}

export function parseLocalIntent(prompt: string): WhitelistAction[] {
  const p = prompt.toLowerCase().trim()
  const actions: WhitelistAction[] = []

  // 1. Workspaces (1..9)
  const wsMatch = p.match(/(?:воркспейс|стол|рабочий стол|переключи на|перейди на)\s*(\d)/)
  if (wsMatch) {
    const idx = parseInt(wsMatch[1], 10)
    if (idx >= 1 && idx <= 9) {
      actions.push({ action: "focus_workspace", args: { index: idx } })
      return actions
    }
  }

  // Move window to workspace
  const moveMatch = p.match(/(?:перенеси|передвинь|окно на)\s*(?:воркспейс|стол|рабочий стол)?\s*(\d)/)
  if (moveMatch) {
    const idx = parseInt(moveMatch[1], 10)
    if (idx >= 1 && idx <= 9) {
      actions.push({ action: "move_window_to_workspace", args: { index: idx } })
      return actions
    }
  }

  // 2. Launching Apps
  if (p.includes("телеграм") || p.includes("telegram") || p.includes("телега")) {
    actions.push({ action: "launch_app", args: { app_name: "telegram" } })
  } else if (p.includes("браузер") || p.includes("firefox") || p.includes("инет")) {
    actions.push({ action: "launch_app", args: { app_name: "firefox" } })
  } else if (p.includes("код") || p.includes("code") || p.includes("vs code")) {
    actions.push({ action: "launch_app", args: { app_name: "code" } })
  } else if (p.includes("терминал") || p.includes("консоль") || p.includes("foot") || p.includes("kitty")) {
    actions.push({ action: "launch_app", args: { app_name: "foot" } })
  } else if (p.includes("обсидиан") || p.includes("obsidian") || p.includes("заметки")) {
    actions.push({ action: "launch_app", args: { app_name: "obsidian" } })
  }

  // 3. Volume
  const volMatch = p.match(/(?:громкость|звук)\s*(\d{1,3})/)
  if (volMatch) {
    actions.push({ action: "set_volume", args: { level: Math.min(100, parseInt(volMatch[1], 10)) } })
  } else if (p.includes("тише") || p.includes("уменьши звук")) {
    actions.push({ action: "set_volume", args: { level: 25 } })
  } else if (p.includes("громче") || p.includes("прибавь звук")) {
    actions.push({ action: "set_volume", args: { level: 75 } })
  }

  // 4. Brightness
  const brightMatch = p.match(/(?:яркость|экран)\s*(\d{1,3})/)
  if (brightMatch) {
    actions.push({ action: "set_brightness", args: { level: Math.min(100, parseInt(brightMatch[1], 10)) } })
  }

  // 5. System Power
  if (p.includes("выключи") || p.includes("заверши работу") || p.includes("shutdown")) {
    actions.push({ action: "system_power", args: { mode: "shutdown" } })
  } else if (p.includes("перезагрузи") || p.includes("reboot")) {
    actions.push({ action: "system_power", args: { mode: "reboot" } })
  } else if (p.includes("сон") || p.includes("спящий")) {
    actions.push({ action: "system_power", args: { mode: "suspend" } })
  } else if (p.includes("заблокируй") || p.includes("lock")) {
    actions.push({ action: "system_power", args: { mode: "lock" } })
  }

  return actions
}

// §1.1 features_plan.md — Jarvis HTTP Client. Изоляция ошибок транспорта от
// ошибок парсинга ответа: вызывающий код различает их по .kind.
export async function callIntent(prompt: string): Promise<WhitelistAction[]> {
  const localActions = parseLocalIntent(prompt)
  if (localActions.length > 0) {
    return localActions
  }

  const { server_url } = getPreferences()
  const token = getSecret("DESKTOP_AGS_TOKEN")

  if (!server_url || !token) {
    return localActions
  }

  let response: Response
  try {
    response = await fetch(`${server_url}/intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ prompt }),
    })
  } catch (e) {
    if (localActions.length > 0) return localActions
    throw new JarvisClientError(`Сеть недоступна: ${e}`, "transport")
  }

  if (response.status === 401) {
    if (localActions.length > 0) return localActions
    throw new JarvisClientError("Сервер отклонил токен (401)", "auth")
  }
  if (!response.ok) {
    if (localActions.length > 0) return localActions
    throw new JarvisClientError(`Сервер вернул ${response.status}`, "transport")
  }

  try {
    const body = await response.text()
    const data = JSON.parse(body)
    const serverActions = Array.isArray(data.actions) ? data.actions : []
    return serverActions.length > 0 ? serverActions : localActions
  } catch (e) {
    return localActions
  }
}

export async function callClassify(appClass: string, windowTitle: string): Promise<number> {
  const { server_url } = getPreferences()
  const token = getSecret("DESKTOP_AGS_TOKEN")
  if (!server_url || !token) throw new JarvisClientError("Не настроено", "config")

  const response = await fetch(`${server_url}/classify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ app_class: appClass, window_title: windowTitle }),
  })
  const data = JSON.parse(await response.text())
  return typeof data.workspace === "number" ? data.workspace : 2
}

export async function callAiPrompt(prompt: string): Promise<{ reply: string; actions?: WhitelistAction[] }> {
  const { server_url } = getPreferences()
  const token = getSecret("DESKTOP_AGS_TOKEN")

  if (!server_url || !token) {
    throw new JarvisClientError(
      "server_url или DESKTOP_AGS_TOKEN не настроены (preferences.json / secrets.json)",
      "config",
    )
  }

  let response: Response
  try {
    response = await fetch(`${server_url}/intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ prompt }),
    })
  } catch (e) {
    throw new JarvisClientError(`Сеть недоступна: ${e}`, "transport")
  }

  if (response.status === 401) {
    throw new JarvisClientError("Сервер отклонил токен (401)", "auth")
  }
  if (!response.ok) {
    throw new JarvisClientError(`Сервер вернул ${response.status}`, "transport")
  }

  try {
    const body = await response.text()
    const data = JSON.parse(body)
    const reply = data.reply || data.response || (Array.isArray(data.actions) && data.actions.length > 0
      ? `Найдено команд: ${data.actions.length}`
      : "Запрос обработан")
    return { reply, actions: Array.isArray(data.actions) ? data.actions : [] }
  } catch (e) {
    throw new JarvisClientError(`Не удалось разобрать ответ сервера: ${e}`, "parse")
  }
}

