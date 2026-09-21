import type { LevelData } from "../map/levelFormat"
import { pointInPolygon } from "../map/geometry"
import { objectPairId } from "../map/levelFormat"
import { t } from "../i18n"
import type { ValidationIssue, ValidationMarkers } from "./validate"

export type FocusTarget = | { kind: "region"; index: number }
  | { kind: "object"; index: number }
  | { kind: "player" }
  | { kind: "none" }

export type RichIssue = ValidationIssue & {
  id: string
  focus: FocusTarget
}

function regionAt(level: LevelData, x: number, y: number) {
  return level.regions.find((r) => pointInPolygon(x, y, r.vertices))
}

function heightOk(z: number, floor: number, ceil: number): boolean {
  return z >= floor - 0.5 && z <= ceil + 0.5
}

function regionsOverlap2d(a: [number, number][], b: [number, number][]): boolean {
  const samples: [number, number][] = []
  for (const poly of [a, b]) {
    const cx = poly.reduce((s, v) => s + v[0], 0) / poly.length
    const cy = poly.reduce((s, v) => s + v[1], 0) / poly.length
    samples.push([cx, cy])
    poly.forEach((v) => samples.push(v))
  }
  const aHits = samples.some(([x, y]) => pointInPolygon(x, y, a) && pointInPolygon(x, y, b))
  return aHits
}

function volumesOverlap(level: LevelData, i: number, j: number): boolean {
  const a = level.regions[i]
  const b = level.regions[j]
  if (a.ceil <= b.floor || b.ceil <= a.floor) {
    return false
  }
  return regionsOverlap2d(a.vertices, b.vertices)
}

function buildAdjacency(level: LevelData): Map<number, Set<number>> {
  const adj = new Map<number, Set<number>>()
  level.regions.forEach((_, i) => adj.set(i, new Set()))
  const key = (x: number, y: number) => `${x},${y}`
  const vertMap = new Map<string, number[]>()
  level.regions.forEach((r, ri) => {
    r.vertices.forEach(([x, y]) => {
      const k = key(x, y)
      const list = vertMap.get(k) || []
      list.push(ri)
      vertMap.set(k, list)
    })
  })
  vertMap.forEach((list) => {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        adj.get(list[i])!.add(list[j])
        adj.get(list[j])!.add(list[i])
      }
    }
  })

  level.regions.forEach((ra, i) => {
    level.regions.forEach((rb, j) => {
      if (j <= i) return
      for (let ei = 0; ei < ra.vertices.length; ei++) {
        const a0 = ra.vertices[ei]
        const a1 = ra.vertices[(ei + 1) % ra.vertices.length]
        for (let ej = 0; ej < rb.vertices.length; ej++) {
          const b0 = rb.vertices[ej]
          const b1 = rb.vertices[(ej + 1) % rb.vertices.length]
          const same = (a0[0] === b0[0] && a0[1] === b0[1] && a1[0] === b1[0] && a1[1] === b1[1]) || (a0[0] === b1[0] && a0[1] === b1[1] && a1[0] === b0[0] && a1[1] === b0[1])
          if (same) {
            adj.get(i)!.add(j)
            adj.get(j)!.add(i)
          }
        }
      }
    })
  })

  return adj
}

function floodReachable(adj: Map<number, Set<number>>, start: number): Set<number> {
  const seen = new Set<number>()
  const q = [start]
  seen.add(start)
  while (q.length) {
    const cur = q.pop()!
    adj.get(cur)?.forEach((n) => {
      if (!seen.has(n)) {
        seen.add(n)
        q.push(n)
      }
    })
  }
  return seen
}

export function extendValidation(
  level: LevelData,
  baseIssues: ValidationIssue[],
  markers: ValidationMarkers,
): { issues: RichIssue[]; markers: ValidationMarkers } {
  const issues: RichIssue[] = baseIssues.map((issue, i) => ({
    ...issue,
    id: `base-${i}`,
    focus: inferFocus(issue, markers),
  }))

  level.objects.forEach((obj, oi) => {
    const region = regionAt(level, obj.x, obj.y)
    if (!region) {
      return
    }

    const z = (obj.z ?? 0) + region.floor
    if (!heightOk(z, region.floor, region.ceil)) {
      markers.objectsOutside.add(oi)
      issues.push({
        id: `height-obj-${oi}`,
        level: "warn",
        message: t("validate.objectHeight", { n: oi + 1, type: obj.type }),
        focus: { kind: "object", index: oi },
      })
    }
  })

  if (level.player) {
    const region = regionAt(level, level.player.x, level.player.y)
    if (region) {
      const z = level.player.z ?? 10
      if (!heightOk(z, region.floor, region.ceil)) {
        markers.playerOutside = true
        issues.push({
          id: "height-player",
          level: "warn",
          message: t("validate.playerHeight"),
          focus: { kind: "player" },
        })
      }
    }
  }

  for (let i = 0; i < level.regions.length; i++) {
    for (let j = i + 1; j < level.regions.length; j++) {
      if (volumesOverlap(level, i, j)) {
        issues.push({
          id: `overlap-${i}-${j}`,
          level: "warn",
          message: t("validate.overlap", { a: i + 1, b: j + 1 }),
          focus: { kind: "region", index: i },
        })
      }
    }
  }

  const adj = buildAdjacency(level)
  const player = level.player
  if (player) {
    const startRi = level.regions.findIndex((r) => pointInPolygon(player.x, player.y, r.vertices))
    if (startRi >= 0) {
      const reachable = floodReachable(adj, startRi)
      level.regions.forEach((_, ri) => {
        if (!reachable.has(ri)) {
          issues.push({
            id: `unreach-${ri}`,
            level: "warn",
            message: t("validate.unreachable", { region: ri + 1 }),
            focus: { kind: "region", index: ri },
          })
        }
      })

      level.objects.forEach((obj, oi) => {
        if (obj.type !== "goal") {
          return
        }
        const gri = level.regions.findIndex((r) => pointInPolygon(obj.x, obj.y, r.vertices))
        if (gri >= 0 && !reachable.has(gri)) {
          issues.push({
            id: `goal-unreach-${oi}`,
            level: "warn",
            message: t("validate.goalUnreachable", { n: oi + 1 }),
            focus: { kind: "object", index: oi },
          })
        }
      })
    }
  }

  level.objects.forEach((obj, oi) => {
    if (obj.type !== "door") {
      return
    }

    const region = regionAt(level, obj.x, obj.y)
    if (!region) {
      return
    }

    let minD = Infinity
    for (let i = 0; i < region.vertices.length; i++) {
      const [ax, ay] = region.vertices[i]
      const [bx, by] = region.vertices[(i + 1) % region.vertices.length]
      const d = distToSegment(obj.x, obj.y, ax, ay, bx, by)
      minD = Math.min(minD, d)
    }

    if (minD > 20) {
      issues.push({
        id: `door-edge-${oi}`,
        level: "warn",
        message: t("validate.doorAwayFromEdge", { n: oi + 1 }),
        focus: { kind: "object", index: oi },
      })
    }
  })

  const pairCounts = new Map<number, { goals: number; doors: number }>()
  level.objects.forEach((obj) => {
    if (obj.type !== "goal" && obj.type !== "door") {
      return
    }

    const id = objectPairId(obj)
    const c = pairCounts.get(id) || { goals: 0, doors: 0 }
    if (obj.type === "goal") c.goals++
    else c.doors++
    pairCounts.set(id, c)
  })
  pairCounts.forEach((c, id) => {
    if (c.goals > 1 || c.doors > 1) {
      issues.push({
        id: `pair-dup-${id}`,
        level: "warn",
        message: t("validate.pairDuplicate", { id, goals: c.goals, doors: c.doors }),
        focus: { kind: "none" },
      })
    }
  })

  return { issues, markers }
}

function inferFocus(issue: ValidationIssue, markers: ValidationMarkers): FocusTarget {
  if (issue.message.includes("Player") || markers.playerOutside && issue.message.toLowerCase().includes("player")) {
    return { kind: "player" }
  }
  
  return { kind: "none" }
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy || 1
  let t = ((px - ax) * dx + (py - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const x = ax + t * dx
  const y = ay + t * dy
  return Math.hypot(px - x, py - y)
}
