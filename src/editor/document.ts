import type { EditorMode } from "./types"

export type RebuildReason = "geometry" | "selection" | "view" | "level-switch"

export const PREVIEW_REBUILD_DEBOUNCE_MS = 120

export type HotkeyEntry = {
  keys: string
  action: string
  i18nKey: string
}

export const EDITOR_HOTKEYS: HotkeyEntry[] = [
  { keys: "1", action: "mode-select", i18nKey: "hotkey.modeSelect" },
  { keys: "2", action: "mode-region", i18nKey: "hotkey.modeRegion" },
  { keys: "3", action: "mode-object", i18nKey: "hotkey.modeObject" },
  { keys: "4", action: "mode-player", i18nKey: "hotkey.modePlayer" },
  { keys: "5", action: "mode-measure", i18nKey: "hotkey.modeMeasure" },
  { keys: "F", action: "focus-selection", i18nKey: "hotkey.focus" },
  { keys: "G", action: "toggle-grid", i18nKey: "hotkey.grid" },
  { keys: "H", action: "toggle-ghost", i18nKey: "hotkey.ghost" },
  { keys: "?", action: "cheat-sheet", i18nKey: "hotkey.help" },
  { keys: "Ctrl+Z", action: "undo", i18nKey: "hotkey.undo" },
  { keys: "Ctrl+Y", action: "redo", i18nKey: "hotkey.redo" },
  { keys: "Ctrl+C / Ctrl+V", action: "copy-paste", i18nKey: "hotkey.copyPaste" },
  { keys: "Delete", action: "delete", i18nKey: "hotkey.delete" },
  { keys: "Enter", action: "close-polygon", i18nKey: "hotkey.closePoly" },
  { keys: "Esc", action: "cancel", i18nKey: "hotkey.cancel" },
  { keys: "WASD + RMB", action: "fly-camera", i18nKey: "hotkey.fly" },
  { keys: "Alt+LMB", action: "orbit", i18nKey: "hotkey.orbit" },
  { keys: "Shift+click", action: "multi-select / insert vertex", i18nKey: "hotkey.shift" },
  { keys: "E", action: "extrude-region", i18nKey: "hotkey.extrude" },
  { keys: "B", action: "box-room primitive", i18nKey: "hotkey.boxRoom" },
]

export const TOOL_MODES: EditorMode[] = ["select", "region", "object", "player", "measure"]

export function shouldRebuildMeshes(reason: RebuildReason): boolean {
  return reason === "geometry" || reason === "level-switch"
}
