import { pointInPolygon } from "../map/geometry"
import type { LevelData } from "../map/levelFormat"
import { objectPairId } from "../map/levelFormat"
import { t } from "../i18n"

export type ValidationIssue = {
  level: "error" | "warn"
  message: string
}

export type ValidationMarkers = {
  objectsOutside: Set<number>
  regionsSelfIntersect: Set<number>
  playerOutside: boolean
  goalsWithoutDoor: Set<number>
  doorsWithoutGoal: Set<number>
}

function objectInsideRegion(x: number, y: number, level: LevelData): boolean {
  return level.regions.some((region) => pointInPolygon(x, y, region.vertices))
}

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx
}

function onSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): boolean {
  return (
    Math.min(ax, bx) <= px && px <= Math.max(ax, bx)
    && Math.min(ay, by) <= py && py <= Math.max(ay, by)
  )
}

function segmentsIntersect(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): boolean {
  const d1 = cross(bx - ax, by - ay, cx - ax, cy - ay)
  const d2 = cross(bx - ax, by - ay, dx - ax, dy - ay)
  const d3 = cross(dx - cx, dy - cy, ax - cx, ay - cy)
  const d4 = cross(dx - cx, dy - cy, bx - cx, by - cy)

  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0))
    && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  ) {
    return true
  }

  if (d1 === 0 && onSegment(cx, cy, ax, ay, bx, by)) {
    return true
  }

  if (d2 === 0 && onSegment(dx, dy, ax, ay, bx, by)) {
    return true
  }

  if (d3 === 0 && onSegment(ax, ay, cx, cy, dx, dy)) {
    return true
  }

  if (d4 === 0 && onSegment(bx, by, cx, cy, dx, dy)) {
    return true
  }

  return false
}

function polygonSelfIntersects(vertices: [number, number][]): boolean {
  const n = vertices.length
  if (n < 4) {
    return false
  }

  for (let i = 0; i < n; i++) {
    const [ax, ay] = vertices[i]
    const [bx, by] = vertices[(i + 1) % n]
    for (let j = i + 1; j < n; j++) {
      if (j === i || j === (i + 1) % n || (j + 1) % n === i) {
        continue
      }

      const [cx, cy] = vertices[j]
      const [dx, dy] = vertices[(j + 1) % n]
      if (segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy)) {
        return true
      }
    }
  }

  return false
}

export function analyzeLevel(level: LevelData, levelLabel: string): {
  issues: ValidationIssue[]
  markers: ValidationMarkers
} {
  const issues: ValidationIssue[] = []
  const markers: ValidationMarkers = {
    objectsOutside: new Set(),
    regionsSelfIntersect: new Set(),
    playerOutside: false,
    goalsWithoutDoor: new Set(),
    doorsWithoutGoal: new Set(),
  }

  if (!level.regions.length) {
    issues.push({ 
      level: "error", 
      message: t("validate.noRegions", { 
        where: levelLabel 
      }) 
    })

    return { issues, markers }
  }

  level.regions.forEach((region, ri) => {
    if (region.vertices.length < 3) {
      issues.push({
        level: "error",
        message: t("validate.minVertices", { 
          where: levelLabel, 
          region: ri + 1 
        }),
      })
    }
    
    if (polygonSelfIntersects(region.vertices)) {
      markers.regionsSelfIntersect.add(ri)
      issues.push({
        level: "warn",
        message: t("validate.selfIntersect", { 
          region: ri + 1 
        }),
      })
    }
  })

  level.objects.forEach((obj, oi) => {
    if (!objectInsideRegion(obj.x, obj.y, level)) {
      markers.objectsOutside.add(oi)
      issues.push({
        level: "warn",
        message: t("validate.objectOutside", { 
          n: oi + 1, 
          type: obj.type 
        }),
      })
    }
  })

  const player = level.player
  if (player && !objectInsideRegion(player.x, player.y, level)) {
    markers.playerOutside = true
    issues.push({ 
      level: "warn", 
      message: t("validate.playerOutside") 
    })
  }

  const goals = level.objects.map((o, i) => ({ o, i })).filter(({ o }) => o.type === "goal")
  const doors = level.objects.map((o, i) => ({ o, i })).filter(({ o }) => o.type === "door")

  goals.forEach(({ o: goal, i: gi }) => {
    const pairId = objectPairId(goal)
    if (!doors.some(({ o: door }) => objectPairId(door) === pairId)) {
      markers.goalsWithoutDoor.add(gi)
      issues.push({
        level: "warn",
        message: t("validate.goalWithoutDoor", { n: gi + 1 }),
      })
    }
  })

  doors.forEach(({ o: door, i: di }) => {
    const pairId = objectPairId(door)
    if (!goals.some(({ o: goal }) => objectPairId(goal) === pairId)) {
      markers.doorsWithoutGoal.add(di)
      issues.push({
        level: "warn",
        message: t("validate.doorWithoutGoal", { 
          n: di + 1
        }),
      })
    }
  })

  return { issues, markers }
}

export function validateLevel(level: LevelData, levelLabel: string): ValidationIssue[] {
  return analyzeLevel(level, levelLabel).issues
}
