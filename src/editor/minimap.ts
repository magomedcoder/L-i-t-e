import type { LevelData } from "../map/levelFormat"
import type { LevelBounds } from "./bounds"

const OBJECT_DOT: Record<string, string> = {
  enemy: "#e35d5d",
  flying: "#ff8a5b",
  health: "#5b8cff",
  goal: "#f0d35b",
  door: "#c28bff",
  flashlight: "#9ae66e",
  many: "#ff5b9a",
}

export type ViewportState = {
  panX: number
  panY: number
  scale: number
  viewW: number
  viewH: number
}

export function drawMinimap(ctx: CanvasRenderingContext2D, level: LevelData, bounds: LevelBounds, viewport: ViewportState): void {
  const w = ctx.canvas.width
  const h = ctx.canvas.height
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = "#0b0d12"
  ctx.fillRect(0, 0, w, h)

  const bw = bounds.maxX - bounds.minX
  const bh = bounds.maxY - bounds.minY
  if (bw <= 0 || bh <= 0) {
    return
  }

  const pad = 4
  const scale = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh)
  const ox = pad + (w - pad * 2 - bw * scale) / 2
  const oy = pad + (h - pad * 2 - bh * scale) / 2

  const tx = (x: number) => ox + (x - bounds.minX) * scale
  const ty = (y: number) => oy + (y - bounds.minY) * scale

  level.regions.forEach((region) => {
    ctx.beginPath()
    region.vertices.forEach(([x, y], i) => {
      if (i === 0) {
        ctx.moveTo(tx(x), ty(y))
      } else {
        ctx.lineTo(tx(x), ty(y))
      }
    })
    ctx.closePath()
    ctx.fillStyle = "rgba(62,207,142,0.25)"
    ctx.strokeStyle = "#3ecf8e"
    ctx.lineWidth = 1
    ctx.fill()
    ctx.stroke()
  })

  level.objects.forEach((obj) => {
    ctx.fillStyle = OBJECT_DOT[obj.type] ?? "#aaa"
    ctx.beginPath()
    ctx.arc(tx(obj.x), ty(obj.y), 2, 0, Math.PI * 2)
    ctx.fill()
  })

  if (level.player) {
    ctx.fillStyle = "#fff"
    ctx.beginPath()
    ctx.arc(tx(level.player.x), ty(level.player.y), 2.5, 0, Math.PI * 2)
    ctx.fill()
  }

  const wx0 = -viewport.panX / viewport.scale
  const wy0 = -viewport.panY / viewport.scale
  const wx1 = (viewport.viewW - viewport.panX) / viewport.scale
  const wy1 = (viewport.viewH - viewport.panY) / viewport.scale
  const vx = tx(wx0)
  const vy = ty(wy0)
  const vw = (wx1 - wx0) * scale
  const vh = (wy1 - wy0) * scale

  ctx.strokeStyle = "#3d7eff"
  ctx.lineWidth = 1.5
  ctx.strokeRect(vx, vy, vw, vh)
}

export function minimapWorldFromEvent(e: MouseEvent, canvas: HTMLCanvasElement, bounds: LevelBounds): [number, number] | null {
  const rect = canvas.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const w = canvas.width
  const h = canvas.height
  const bw = bounds.maxX - bounds.minX
  const bh = bounds.maxY - bounds.minY
  if (bw <= 0 || bh <= 0) {
    return null
  }

  const pad = 4
  const scale = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh)
  const ox = pad + (w - pad * 2 - bw * scale) / 2
  const oy = pad + (h - pad * 2 - bh * scale) / 2
  const wx = bounds.minX + (mx - ox) / scale
  const wy = bounds.minY + (my - oy) / scale
  return [wx, wy]
}
