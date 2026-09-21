import type { LevelRegion } from "../../map/levelFormat"
import { snapCoord } from "../types"

export type PrimitiveKind = "box" | "corridor" | "ramp"

export function makeBoxRoom(
  cx: number,
  cy: number,
  size = 64,
  floor = 4,
  ceil = 40,
  gridStep = 4,
): LevelRegion {
  const h = size / 2
  const s = (n: number) => snapCoord(n, gridStep)
  return {
    vertices: [
      [s(cx - h), s(cy - h)],
      [s(cx + h), s(cy - h)],
      [s(cx + h), s(cy + h)],
      [s(cx - h), s(cy + h)],
    ],
    floor,
    ceil,
  }
}

export function makeCorridor(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width = 24,
  floor = 4,
  ceil = 40,
  gridStep = 4,
): LevelRegion {
  const s = (n: number) => snapCoord(n, gridStep)
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy) || 1
  const nx = (-dy / len) * (width / 2)
  const ny = (dx / len) * (width / 2)
  return {
    vertices: [
      [s(x0 + nx), s(y0 + ny)],
      [s(x1 + nx), s(y1 + ny)],
      [s(x1 - nx), s(y1 - ny)],
      [s(x0 - nx), s(y0 - ny)],
    ],
    floor,
    ceil,
  }
}

export function makeRamp(
  cx: number,
  cy: number,
  length = 64,
  width = 32,
  floorStart = 4,
  floorEnd = 20,
  ceil = 44,
  steps = 4,
  gridStep = 4,
): LevelRegion[] {
  const s = (n: number) => snapCoord(n, gridStep)
  const out: LevelRegion[] = []
  const stepLen = length / steps
  const stepH = (floorEnd - floorStart) / steps
  const y0 = cy - width / 2
  const y1 = cy + width / 2
  for (let i = 0; i < steps; i++) {
    const x0 = cx - length / 2 + i * stepLen
    const x1 = x0 + stepLen
    const fl = floorStart + i * stepH
    out.push({
      vertices: [
        [s(x0), s(y0)],
        [s(x1), s(y0)],
        [s(x1), s(y1)],
        [s(x0), s(y1)],
      ],
      floor: fl,
      ceil,
    })
  }
  
  return out
}
