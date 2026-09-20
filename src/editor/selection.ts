import { pointInPolygon } from "../map/geometry"
import type { LevelData } from "../map/levelFormat"
import { snapCoord } from "./types"

export function pickRegion(level: LevelData, x: number, y: number): number {
  for (let i = level.regions.length - 1; i >= 0; i--) {
    if (pointInPolygon(x, y, level.regions[i].vertices)) {
      return i
    }
  }

  return -1
}

export function pickObject(level: LevelData, x: number, y: number, scale: number): number {
  let best = -1
  let bestD = 12 / scale
  level.objects.forEach((o, i) => {
    const d = Math.hypot(o.x - x, o.y - y)
    if (d < bestD) {
      bestD = d
      best = i
    }
  })

  return best
}

export function pickPlayer(level: LevelData, x: number, y: number, scale: number): boolean {
  const p = level.player || { x: 24, y: -16 }
  return Math.hypot(p.x - x, p.y - y) < 12 / scale
}

export function pickVertex(level: LevelData, regionIndex: number, x: number, y: number, scale: number): number {
  const verts = level.regions[regionIndex]?.vertices
  if (!verts) {
    return -1
  }

  let best = -1
  let bestD = 10 / scale
  verts.forEach(([vx, vy], i) => {
    const d = Math.hypot(vx - x, vy - y)
    if (d < bestD) {
      bestD = d
      best = i
    }
  })
  return best
}

export function nearestEdgeInsert(level: LevelData, regionIndex: number, x: number, y: number, gridStep: number, scale: number): number {
  const verts = level.regions[regionIndex].vertices
  let bestEdge = -1
  let bestD = 12 / scale
  for (let i = 0; i < verts.length; i++) {
    const [x1, y1] = verts[i]
    const [x2, y2] = verts[(i + 1) % verts.length]
    const dx = x2 - x1
    const dy = y2 - y1
    const len2 = dx * dx + dy * dy
    const t = len2 ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2)) : 0
    const px = x1 + t * dx
    const py = y1 + t * dy
    const d = Math.hypot(px - x, py - y)
    if (d < bestD) {
      bestD = d
      bestEdge = i
    }
  }
  
  if (bestEdge < 0) {
    return -1
  }

  const [x1, y1] = verts[bestEdge]
  const [x2, y2] = verts[(bestEdge + 1) % verts.length]
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  const t = len2 ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2)) : 0
  const px = snapCoord(x1 + t * dx, gridStep)
  const py = snapCoord(y1 + t * dy, gridStep)
  verts.splice(bestEdge + 1, 0, [px, py])
  return bestEdge + 1
}
