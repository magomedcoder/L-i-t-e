import type { ObjectType } from "../map/levelFormat"
import { DEFAULT_GRID_STEP } from "./types"

export type ViewLayers = {
  regions: boolean
  objects: boolean
  player: boolean
  grid: boolean
  helpers: boolean
}

export type EditorViewState = {
  gridStep: number
  layers: ViewLayers
  objectFilter: ObjectType | ""
  layout: "split" | "2d" | "3d"
  ghostMode: boolean
  sectionZ: number | null
  showLinks: boolean
  showAxis: boolean
}

export function createDefaultViewState(): EditorViewState {
  return {
    gridStep: DEFAULT_GRID_STEP,
    layers: {
      regions: true,
      objects: true,
      player: true,
      grid: true,
      helpers: true,
    },
    objectFilter: "",
    layout: "2d",
    ghostMode: false,
    sectionZ: null,
    showLinks: true,
    showAxis: true,
  }
}
