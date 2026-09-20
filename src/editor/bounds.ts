import type { LevelData } from "../map/levelFormat"

export type LevelBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function getLevelBounds(level: LevelData, pad = 32): LevelBounds {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  const add = (x: number, y: number) => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }

  level.regions.forEach((r) => r.vertices.forEach(([x, y]) => add(x, y)))
  level.objects.forEach((o) => add(o.x, o.y))
  if (level.player) {
    add(level.player.x, level.player.y)
  }

  if (!Number.isFinite(minX)) {
    return {
      minX: -64,
      minY: -64,
      maxX: 64,
      maxY: 64
    }
  }

  return {
    minX: minX - pad,
    minY: minY - pad,
    maxX: maxX + pad,
    maxY: maxY + pad,
  }
}
