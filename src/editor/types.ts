export type EditorMode = "select" | "region" | "object" | "player"

export type Selection = | { kind: "none" }
  | { kind: "object"; index: number }
  | { kind: "region"; index: number }
  | { kind: "vertex"; region: number; vertex: number }
  | { kind: "player" }

export type DragState = | { kind: "none" }
  | { kind: "pan" }
  | { kind: "object"; index: number }
  | { kind: "player" }
  | { kind: "vertex"; region: number; vertex: number }
  | { kind: "region"; index: number; verts: [number, number][]; startX: number; startY: number }

export const DEFAULT_GRID_STEP = 4

export function snapCoord(value: number, gridStep = DEFAULT_GRID_STEP): number {
  return Math.round(value / gridStep) * gridStep
}
