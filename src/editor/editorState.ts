import type { Campaign, LevelData } from "../map/levelFormat"
import { t } from "../i18n"
import { emptyLevel } from "./helpers"
import { createDefaultViewState, type EditorViewState } from "./state"
import type { ValidationMarkers } from "./validate"
import type { DragState, EditorMode, Selection } from "./types"

export type EditorCamera = {
  scale: number
  panX: number
  panY: number
}

export type EditorClipboard = | { 
  kind: "object"
  data: import("../map/levelFormat").LevelObject
} | { 
  kind: "region"
  data: import("../map/levelFormat").LevelRegion
} | null

export type EditorState = {
  mapId: string
  campaign: Campaign
  levelIndex: number
  mode: EditorMode
  selection: Selection
  drag: DragState
  draftVerts: [number, number][]
  camera: EditorCamera
  viewState: EditorViewState
  clipboard: EditorClipboard
  dirty: boolean
  markers: ValidationMarkers
}

export function createEditorState(mapId = "default"): EditorState {
  return {
    mapId,
    campaign: {
      name: t("level.loading"),
      levels: [emptyLevel(t("level.loading"))],
    },
    levelIndex: 0,
    mode: "select",
    selection: { kind: "none" },
    drag: { kind: "none" },
    draftVerts: [],
    camera: { scale: 2.2, panX: 80, panY: 80 },
    viewState: createDefaultViewState(),
    clipboard: null,
    dirty: false,
    markers: {
      objectsOutside: new Set(),
      regionsSelfIntersect: new Set(),
      playerOutside: false,
      goalsWithoutDoor: new Set(),
      doorsWithoutGoal: new Set(),
    },
  }
}

export function currentLevel(state: EditorState): LevelData {
  return state.campaign.levels[state.levelIndex]
}

export function editorSnapshot(state: EditorState) {
  return {
    campaign: state.campaign,
    levelIndex: state.levelIndex,
    selection: state.selection,
  }
}

export function clearSelection(state: EditorState): void {
  state.selection = { kind: "none" }
}
