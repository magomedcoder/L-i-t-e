import type { LevelData, ObjectType } from "../map/levelFormat"
import { objectPairId } from "../map/levelFormat"
import type { ViewLayers } from "./state"
import type { Selection } from "./types"
import type { ValidationMarkers } from "./validate"

const OBJECT_COLORS: Record<ObjectType, string> = {
  enemy: "#e35d5d",
  flying: "#ff8a5b",
  health: "#5b8cff",
  goal: "#f0d35b",
  door: "#c28bff",
  flashlight: "#9ae66e",
  many: "#ff5b9a",
}

export type DrawOptions = {
  markers?: ValidationMarkers
  layers?: ViewLayers
  objectFilter?: ObjectType | ""
  gridStep?: number
}

function drawThetaArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  theta: number,
  scale: number,
  color: string,
): void {
  const len = 14 / scale
  const ex = x + Math.cos(theta) * len
  const ey = y + Math.sin(theta) * len
  ctx.strokeStyle = color
  ctx.lineWidth = 2 / scale
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(ex, ey)
  ctx.stroke()
  const head = 5 / scale
  const a1 = theta + Math.PI * 0.8
  const a2 = theta - Math.PI * 0.8
  ctx.beginPath()
  ctx.moveTo(ex, ey)
  ctx.lineTo(ex + Math.cos(a1) * head, ey + Math.sin(a1) * head)
  ctx.moveTo(ex, ey)
  ctx.lineTo(ex + Math.cos(a2) * head, ey + Math.sin(a2) * head)
  ctx.stroke()
}

function pairedGoalDoor(level: LevelData): Set<number> {
  const paired = new Set<number>()
  const goals = level.objects.filter((o) => o.type === "goal")
  const doors = level.objects.filter((o) => o.type === "door")
  goals.forEach((goal) => {
    const pairId = objectPairId(goal)
    if (doors.some((door) => objectPairId(door) === pairId)) {
      paired.add(pairId)
    }
  })
  return paired
}

export function drawEditorLevel(
  ctx: CanvasRenderingContext2D,
  level: LevelData,
  draftVerts: [number, number][],
  selection: Selection,
  scale: number,
  options: DrawOptions = {},
): void {
  const { markers, layers, objectFilter = "" } = options
  const showRegions = layers?.regions ?? true
  const showObjects = layers?.objects ?? true
  const showPlayer = layers?.player ?? true
  const paired = pairedGoalDoor(level)

  if (showRegions) {
    level.regions.forEach((region, i) => {
      const selected = selection.kind === "region" && selection.index === i
      const invalid = markers?.regionsSelfIntersect.has(i)
      ctx.beginPath()
      region.vertices.forEach(([x, y], vi) => {
        if (vi === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      ctx.closePath()
      if (invalid) {
        ctx.fillStyle = "rgba(227,93,93,0.22)"
        ctx.strokeStyle = "#e35d5d"
      } else {
        ctx.fillStyle = selected ? "rgba(61,126,255,0.28)" : "rgba(62,207,142,0.16)"
        ctx.strokeStyle = selected ? "#3d7eff" : "#3ecf8e"
      }
      ctx.lineWidth = (selected || invalid ? 2.5 : 1.5) / scale
      ctx.fill()
      ctx.stroke()

      const showVerts = selected || (selection.kind === "vertex" && selection.region === i)
      if (showVerts) {
        region.vertices.forEach(([vx, vy], vi) => {
          const vsel = selection.kind === "vertex" && selection.region === i && selection.vertex === vi
          ctx.fillStyle = vsel ? "#fff" : "#3d7eff"
          ctx.beginPath()
          ctx.arc(vx, vy, (vsel ? 5 : 4) / scale, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = "#9aa3b5"
          ctx.font = `${10 / scale}px sans-serif`
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"
          ctx.fillText(String(vi + 1), vx, vy - 10 / scale)
        })
      }
    })
  }

  if (draftVerts.length) {
    ctx.beginPath()
    draftVerts.forEach(([x, y], i) => {
      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.strokeStyle = "#ffcc66"
    ctx.lineWidth = 2 / scale
    ctx.stroke()
    draftVerts.forEach(([x, y]) => {
      ctx.fillStyle = "#ffcc66"
      ctx.beginPath()
      ctx.arc(x, y, 3 / scale, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  if (showObjects) {
    level.objects.forEach((obj, i) => {
      const filtered = objectFilter && obj.type !== objectFilter
      const selected = selection.kind === "object" && selection.index === i
      const theta = obj.theta ?? 0
      const isPairType = obj.type === "goal" || obj.type === "door"
      const isPaired = isPairType && paired.has(objectPairId(obj))
      const invalid = markers && (markers.objectsOutside.has(i) || markers.goalsWithoutDoor.has(i) || markers.doorsWithoutGoal.has(i))

      if (filtered) {
        ctx.globalAlpha = 0.2
      }

      if (invalid) {
        ctx.beginPath()
        ctx.arc(obj.x, obj.y, 12 / scale, 0, Math.PI * 2)
        ctx.strokeStyle = "#e35d5d"
        ctx.lineWidth = 2 / scale
        ctx.stroke()
      } else if (isPaired) {
        ctx.beginPath()
        ctx.arc(obj.x, obj.y, 10 / scale, 0, Math.PI * 2)
        ctx.strokeStyle = "rgba(240,211,91,0.5)"
        ctx.lineWidth = 2 / scale
        ctx.stroke()
      } else if (objectFilter && obj.type === objectFilter) {
        ctx.beginPath()
        ctx.arc(obj.x, obj.y, 10 / scale, 0, Math.PI * 2)
        ctx.strokeStyle = "#3d7eff"
        ctx.lineWidth = 2 / scale
        ctx.stroke()
      }

      ctx.fillStyle = OBJECT_COLORS[obj.type]
      ctx.beginPath()
      ctx.arc(obj.x, obj.y, (selected ? 6 : 4) / scale, 0, Math.PI * 2)
      ctx.fill()
      if (selected) {
        ctx.strokeStyle = "#fff"
        ctx.lineWidth = 2 / scale
        ctx.stroke()
      }

      if (obj.theta != null || isPairType) {
        drawThetaArrow(ctx, obj.x, obj.y, theta, scale, isPaired ? "#f0d35b" : "#aaa")
      }

      ctx.fillStyle = "#ccc"
      ctx.font = `${9 / scale}px sans-serif`
      ctx.textAlign = "left"
      ctx.textBaseline = "top"
      ctx.fillText(obj.type.slice(0, 1).toUpperCase(), obj.x + 6 / scale, obj.y + 2 / scale)
      ctx.globalAlpha = 1
    })
  }

  if (showPlayer) {
    const p = level.player || { x: 24, y: -16 }
    const playerSel = selection.kind === "player"
    if (markers?.playerOutside) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, 12 / scale, 0, Math.PI * 2)
      ctx.strokeStyle = "#e35d5d"
      ctx.lineWidth = 2 / scale
      ctx.stroke()
    }
    ctx.fillStyle = playerSel ? "#3d7eff" : "#fff"
    ctx.beginPath()
    ctx.moveTo(p.x, p.y - 6 / scale)
    ctx.lineTo(p.x + 5 / scale, p.y + 5 / scale)
    ctx.lineTo(p.x - 5 / scale, p.y + 5 / scale)
    ctx.closePath()
    ctx.fill()
    if (playerSel) {
      ctx.strokeStyle = "#fff"
      ctx.lineWidth = 2 / scale
      ctx.stroke()
    }
  }
}

export function drawGrid(ctx: CanvasRenderingContext2D, scale: number, gridStep = 4): void {
  const minor = gridStep
  const major = gridStep * 2
  const extent = 400

  ctx.lineWidth = 1 / scale
  for (let x = -extent; x <= extent; x += minor) {
    ctx.strokeStyle = x % major === 0 ? "#243044" : "#1a2233"
    ctx.beginPath()
    ctx.moveTo(x, -extent)
    ctx.lineTo(x, extent)
    ctx.stroke()
  }
  
  for (let y = -extent; y <= extent; y += minor) {
    ctx.strokeStyle = y % major === 0 ? "#243044" : "#1a2233"
    ctx.beginPath()
    ctx.moveTo(-extent, y)
    ctx.lineTo(extent, y)
    ctx.stroke()
  }
}
