import type { LevelData } from "../../map/levelFormat"
import { edgeLength, polygonArea } from "./geometryOps"

export type MeasureResult = | {
  kind: "none"
} | {
  kind: "distance"
  a: [number, number, number]
  b: [number, number, number]
  length: number
} | {
  kind: "region"
  index: number
  area: number
  height: number
  perimeter: number
}

export type MeasureState = {
  points: [number, number, number][]
  last: MeasureResult
}

export function createMeasureState(): MeasureState {
  return {
    points: [],
    last: {
      kind: "none"
    }
  }
}

export function measureAddPoint(state: MeasureState, p: [number, number, number]): MeasureResult {
  state.points.push(p)
  if (state.points.length >= 2) {
    const a = state.points[state.points.length - 2]
    const b = state.points[state.points.length - 1]
    const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    state.last = { kind: "distance", a, b, length }
    return state.last
  }
  
  state.last = { kind: "none" }
  return state.last
}

export function measureRegion(level: LevelData, index: number): MeasureResult {
  const r = level.regions[index]
  if (!r) {
    return { kind: "none" }
  }

  let peri = 0
  for (let i = 0; i < r.vertices.length; i++) {
    peri += edgeLength(r.vertices[i], r.vertices[(i + 1) % r.vertices.length])
  }

  stateLastRegion(index)
  return {
    kind: "region",
    index,
    area: polygonArea(r.vertices),
    height: r.ceil - r.floor,
    perimeter: peri,
  }
}

function stateLastRegion(_index: number): void {

}

export function formatMeasure(result: MeasureResult): string {
  if (result.kind === "distance") {
    return `Δ ${result.length.toFixed(1)}`
  }

  if (result.kind === "region") {
    return `A=${result.area.toFixed(0)} H=${result.height.toFixed(0)} P=${result.perimeter.toFixed(0)}`
  }
  
  return ""
}
