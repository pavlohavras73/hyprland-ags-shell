import app from "ags/gtk3/app"
import style from "./style.scss"
import Bar from "./widget/Bar"
import Dock from "./widget/Dock"
import Launcher from "./widget/Launcher"
import Cheatsheet from "./widget/Cheatsheet"
import RamEmergency from "./widget/RamEmergency"
import CommandPalette from "./widget/CommandPalette"
import PowerConfirm from "./widget/PowerConfirm"
import ClipboardHistory from "./widget/ClipboardHistory"
import AiWidget from "./widget/AiWidget"
import QuickSettings from "./widget/QuickSettings"
import { startSemanticWorkspaces } from "./services/semanticWorkspaces"
import { startDynamicBlur } from "./services/dynamicBlur"

app.start({
  css: style,
  main() {
    app.get_monitors().map(Bar)
    app.get_monitors().map(Dock)
    Launcher()
    Cheatsheet()
    RamEmergency()
    CommandPalette()
    PowerConfirm()
    ClipboardHistory()
    AiWidget()
    QuickSettings()
    startSemanticWorkspaces()
    startDynamicBlur()
  },
})
