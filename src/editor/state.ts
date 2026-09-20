import type { ObjectType } from "../map/levelFormat"
import { DEFAULT_GRID_STEP } from "./types"

export type ViewLayers = {
  regions: boolean
  objects: boolean
  player: boolean
}

export type EditorViewState = {
  gridStep: number
  layers: ViewLayers
  objectFilter: ObjectType | ""
}

export function createDefaultViewState(): EditorViewState {
  return {
    gridStep: DEFAULT_GRID_STEP,
    layers: { 
      regions: true, 
      objects: true, 
      player: true 
    },
    objectFilter: "",
  }
}
