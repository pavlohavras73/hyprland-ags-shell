import GLib from "gi://GLib"
import { createPoll } from "ags/time"

export interface BatteryInfo {
  percent: number
  charging: boolean
  isBattery: boolean
  status: string
}

export function readDirectBattery(): BatteryInfo {
  for (const bat of ["BAT0", "BAT1"]) {
    const capPath = `/sys/class/power_supply/${bat}/capacity`
    const statPath = `/sys/class/power_supply/${bat}/status`

    if (GLib.file_test(capPath, GLib.FileTest.EXISTS)) {
      try {
        const [okCap, capBytes] = GLib.file_get_contents(capPath)
        if (okCap) {
          const percent = parseInt(new TextDecoder().decode(capBytes).trim(), 10)
          let statusStr = ""
          if (GLib.file_test(statPath, GLib.FileTest.EXISTS)) {
            const [okStat, statBytes] = GLib.file_get_contents(statPath)
            if (okStat) statusStr = new TextDecoder().decode(statBytes).trim()
          }
          const lower = statusStr.toLowerCase()
          const charging = lower.includes("charging") && !lower.includes("not charging")
          return {
            percent: isNaN(percent) ? 100 : Math.min(100, Math.max(0, percent)),
            charging,
            isBattery: true,
            status: statusStr,
          }
        }
      } catch (e) {}
    }
  }

  return { percent: 100, charging: true, isBattery: false, status: "AC" }
}

export const batteryInfo = createPoll<BatteryInfo>(
  readDirectBattery(),
  5000,
  () => readDirectBattery()
)
