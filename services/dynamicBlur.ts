import Hyprland from "gi://AstalHyprland"
import { ramState } from "./ramGuardian"
import { batteryInfo } from "./batteryGuardian"

let currentBlurEnabled: boolean | null = null

function updateBlurState() {
  try {
    const batt = batteryInfo.get()
    const lowBattery = batt.isBattery && batt.percent < 20
    const ramNotOk = ramState.get() !== "ok"

    const shouldDisable = lowBattery || ramNotOk
    const targetBlur = !shouldDisable

    if (currentBlurEnabled !== targetBlur) {
      currentBlurEnabled = targetBlur
      const hyprland = Hyprland.get_default()
      hyprland.dispatch("keyword", `decoration:blur:enabled ${targetBlur ? "true" : "false"}`)
    }
  } catch (e) {
    console.error("[dynamicBlur] failed to update blur:", e)
  }
}

export function startDynamicBlur() {
  ramState.subscribe(updateBlurState)
  batteryInfo.subscribe(updateBlurState)
  updateBlurState()
}
