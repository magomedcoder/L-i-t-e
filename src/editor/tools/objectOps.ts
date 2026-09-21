import type { LevelData, LevelObject } from "../../map/levelFormat"
import { snapCoord } from "../types"

export function alignObjects(level: LevelData, indices: number[], axis: "x" | "y" | "z"): void {
  if (!indices.length) {
    return
  }

  const vals = indices.map((i) => {
    const o = level.objects[i]
    return axis === "z" ? (o.z ?? 0) : axis === "x" ? o.x : o.y
  })
  
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length
  indices.forEach((i) => {
    const o = level.objects[i]
    if (axis === "x") o.x = avg
    else if (axis === "y") o.y = avg
    else o.z = avg
  })
}

export function distributeObjects(level: LevelData, indices: number[], axis: "x" | "y"): void {
  if (indices.length < 3) {
    return
  }

  const sorted = [...indices].sort((a, b) => {
    const oa = level.objects[a]
    const ob = level.objects[b]
    return (axis === "x" ? oa.x : oa.y) - (axis === "x" ? ob.x : ob.y)
  })

  const first = level.objects[sorted[0]]
  const last = level.objects[sorted[sorted.length - 1]]
  const a0 = axis === "x" ? first.x : first.y
  const a1 = axis === "x" ? last.x : last.y
  for (let i = 1; i < sorted.length - 1; i++) {
    const t = i / (sorted.length - 1)
    const v = a0 + (a1 - a0) * t
    if (axis === "x") level.objects[sorted[i]].x = v
    else level.objects[sorted[i]].y = v
  }
}

export function snapObjectsToGrid(level: LevelData, indices: number[], gridStep: number): void {
  indices.forEach((i) => {
    const o = level.objects[i]
    o.x = snapCoord(o.x, gridStep)
    o.y = snapCoord(o.y, gridStep)
    if (o.z != null) {
      o.z = snapCoord(o.z, gridStep)
    }
  })
}

export function snapObjectsToFloor(level: LevelData, indices: number[]): void {
  indices.forEach((i) => {
    const o = level.objects[i]
    const region = level.regions.find((r) => {
      const xs = r.vertices.map((v) => v[0])
      const ys = r.vertices.map((v) => v[1])
      return o.x >= Math.min(...xs) && o.x <= Math.max(...xs) && o.y >= Math.min(...ys) && o.y <= Math.max(...ys)
    })
    if (region) {
      o.z = 0
    }
  })
}

export function duplicateObjects(level: LevelData, indices: number[], offset = 8): number[] {
  const created: number[] = []
  indices.forEach((i) => {
    const copy = structuredClone(level.objects[i]) as LevelObject
    copy.x += offset
    copy.y += offset
    level.objects.push(copy)
    created.push(level.objects.length - 1)
  })

  return created
}

export function pasteOffsetToward(
  obj: LevelObject,
  camForward: {
    x: number
    y: number
  },
  distance = 12,
): LevelObject {
  const next = structuredClone(obj)
  const len = Math.hypot(camForward.x, camForward.y) || 1
  next.x += (camForward.x / len) * distance
  next.y += (camForward.y / len) * distance
  return next
}
