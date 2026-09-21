import type { LevelData, LevelRegion } from "../../map/levelFormat"
import { snapCoord } from "../types"

export function extrudeRegion(level: LevelData, index: number, deltaZ: number): number {
  const src = level.regions[index]
  if (!src) {
    return -1
  }

  const height = src.ceil - src.floor
  const next: LevelRegion = {
    id: src.id ? `${src.id}_up` : undefined,
    texture: src.texture,
    vertices: src.vertices.map(([x, y]) => [x, y] as [number, number]),
    floor: src.ceil + (deltaZ >= 0 ? 0 : deltaZ),
    ceil: src.ceil + (deltaZ >= 0 ? Math.max(4, Math.abs(deltaZ) || height) : 0),
  }

  if (deltaZ < 0) {
    next.floor = src.floor + deltaZ
    next.ceil = src.floor
  } else {
    next.floor = src.ceil
    next.ceil = src.ceil + (Math.abs(deltaZ) || height)
  }

  level.regions.push(next)
  return level.regions.length - 1
}

export function duplicateRegion(level: LevelData, index: number, offset: [number, number] = [16, 0]): number {
  const src = level.regions[index]
  if (!src) {
    return -1
  }

  level.regions.push({
    ...structuredClone(src),
    id: src.id ? `${src.id}_copy` : undefined,
    vertices: src.vertices.map(([x, y]) => [x + offset[0], y + offset[1]] as [number, number]),
  })

  return level.regions.length - 1
}

export function splitEdgeInsert(
  level: LevelData,
  regionIndex: number,
  edgeIndex: number,
  gridStep: number,
): number {
  const region = level.regions[regionIndex]
  if (!region) {
    return -1
  }

  const n = region.vertices.length
  const a = region.vertices[edgeIndex]
  const b = region.vertices[(edgeIndex + 1) % n]
  const mid: [number, number] = [
    snapCoord((a[0] + b[0]) / 2, gridStep),
    snapCoord((a[1] + b[1]) / 2, gridStep),
  ]

  region.vertices.splice(edgeIndex + 1, 0, mid)
  return edgeIndex + 1
}

function sameVert(a: [number, number], b: [number, number], eps = 0.01): boolean {
  return Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps
}

export function mergeRegions(level: LevelData, aIndex: number, bIndex: number): boolean {
  if (aIndex === bIndex || aIndex < 0 || bIndex < 0) {
    return false
  }

  const a = level.regions[aIndex]
  const b = level.regions[bIndex]
  if (!a || !b) {
    return false
  }

  let shared = 0
  for (const va of a.vertices) {
    for (const vb of b.vertices) {
      if (sameVert(va, vb)) {
        shared++
      }
    }
  }

  if (shared < 2) {
    return false
  }

  a.floor = Math.min(a.floor, b.floor)
  a.ceil = Math.max(a.ceil, b.ceil)
  if (!a.texture && b.texture) {
    a.texture = b.texture
  }

  level.regions.splice(bIndex, 1)
  return true
}

export function snapVertexToNearest(
  level: LevelData,
  regionIndex: number,
  vertexIndex: number,
  threshold = 8,
): boolean {
  const region = level.regions[regionIndex]
  if (!region) {
    return false
  }

  const vert = region.vertices[vertexIndex]
  let best: [number, number] | null = null
  let bestD = threshold
  level.regions.forEach((r, ri) => {
    r.vertices.forEach((v, vi) => {
      if (ri === regionIndex && vi === vertexIndex) {
        return
      }

      const d = Math.hypot(v[0] - vert[0], v[1] - vert[1])
      if (d < bestD && d > 0.001) {
        bestD = d
        best = [v[0], v[1]]
      }
    })
  })
  if (!best) {
    return false
  }

  region.vertices[vertexIndex] = best
  return true
}

export function alignVertices(level: LevelData, indices: { region: number; vertex: number }[], axis: "x" | "y"): void {
  if (!indices.length) {
    return
  }

  const vals = indices.map(({ region, vertex }) => level.regions[region].vertices[vertex][axis === "x" ? 0 : 1])
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length
  indices.forEach(({ region, vertex }) => {
    const v = level.regions[region].vertices[vertex]
    if (axis === "x") {
      v[0] = avg
    } else {
      v[1] = avg
    }
  })
}

export function polygonArea(verts: [number, number][]): number {
  let a = 0
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    a += verts[j][0] * verts[i][1] - verts[i][0] * verts[j][1]
  }
  
  return Math.abs(a / 2)
}

export function edgeLength(a: [number, number], b: [number, number]): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1])
}
