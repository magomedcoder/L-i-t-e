import type { EditorState } from "../editorState"
import { clearSelection, currentLevel, markPreviewDirty } from "../editorState"
import type { PreviewRenderer } from "./render3d"
import { cameraEye, focusBounds, flyLook, flyMove, orbitDrag, zoomCamera } from "./camera3d"
import { nearestEdgeAlongRay, raycastLevel, rayFloorIntersection, screenRay, snapVec } from "./raycast"
import { snapCoord } from "../types"
import { splitEdgeInsert } from "../tools/geometryOps"
import { measureAddPoint, measureRegion, formatMeasure } from "../tools/measure"
import type { Vec3 } from "./meshBuild"

export type PreviewInputHost = {
  state: EditorState
  preview: PreviewRenderer
  overlay: HTMLCanvasElement | null
  objectType: () => string
  placeTheta: () => number
  placePairId: () => number
  enemyCount: () => number
  floorDefault: () => number
  ceilDefault: () => number
  beforeEdit: () => void
  afterEdit: () => void
  refreshUi: () => void
  draw2d: () => void
  scheduleRebuild: () => void
  focusSelection: () => void
  getStatus: () => HTMLElement
  onContextMenu: (x: number, y: number, hitKind: string) => void
}

export function bindPreviewInput(host: PreviewInputHost): () => void {
  const { preview, state } = host
  const canvas = preview.canvas
  let lastX = 0
  let lastY = 0
  let lastTs = performance.now()
  let raf = 0

  const loop = () => {
    const now = performance.now()
    const dt = Math.min(0.05, (now - lastTs) / 1000)
    lastTs = now

    if (state.keys.has("KeyW") || state.keys.has("KeyS") || state.keys.has("KeyA") || state.keys.has("KeyD") || state.keys.has("KeyQ") || state.keys.has("KeyE")) {
      if (preview.camera.mode === "fly" || state.keys.has("KeyW")) {
        const f = (state.keys.has("KeyW") ? 1 : 0) + (state.keys.has("KeyS") ? -1 : 0)
        const r = (state.keys.has("KeyD") ? 1 : 0) + (state.keys.has("KeyA") ? -1 : 0)
        const u = (state.keys.has("KeyE") ? 1 : 0) + (state.keys.has("KeyQ") ? -1 : 0)
        flyMove(preview.camera, f, r, u, dt)
      }
    }
    if (state.viewState.layout !== "2d") {
      preview.render()
    }
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)

  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    zoomCamera(preview.camera, e.deltaY)
  }

  const onDown = (e: MouseEvent) => {
    const { x, y, w, h } = preview.screenToCanvas(e.clientX, e.clientY)
    lastX = e.clientX
    lastY = e.clientY
    const ray = screenRay(preview.camera, x, y, w, h)
    const level = currentLevel(state)
    const tris = preview.mesh?.tris || []

    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      state.drag = { kind: "orbit" }
      return
    }

    if (e.button === 2 && !e.shiftKey) {
      state.drag = { kind: "flyLook" }
      preview.camera.mode = "fly"
      if (!preview.camera.eye) {
        preview.camera.eye = cameraEye(preview.camera)
        preview.camera.flyYaw = preview.camera.yaw
        preview.camera.flyPitch = -preview.camera.pitch * 0.3
      }
      return
    }

    if (e.button === 2) {
      e.preventDefault()
      const hit = raycastLevel(ray, level, tris, { preferVertices: true })
      host.onContextMenu(e.clientX, e.clientY, hit.kind)
      return
    }

    if (state.mode === "measure") {
      const floorHit = rayFloorIntersection(ray, host.floorDefault()) || (raycastLevel(ray, level, tris).kind !== "none"
        ? (raycastLevel(ray, level, tris) as { point: Vec3 }).point
        : null)
      if (floorHit) {
        const result = measureAddPoint(state.measure, [floorHit.x, floorHit.y, floorHit.z])
        host.getStatus().textContent = formatMeasure(result)
      }
      return
    }

    if (state.mode === "region") {
      const z = host.floorDefault()
      const p = rayFloorIntersection(ray, z)
      if (p) {
        const sx = snapCoord(p.x, state.viewState.gridStep)
        const sy = snapCoord(p.y, state.viewState.gridStep)
        if (e.shiftKey && state.selection.kind === "region") {
          const edgeHit = nearestEdgeAlongRay(ray, level, state.selection.index)
          if (edgeHit && edgeHit.kind === "edge") {
            host.beforeEdit()
            splitEdgeInsert(level, edgeHit.region, edgeHit.edge, state.viewState.gridStep)
            host.afterEdit()
            markPreviewDirty(state)
            host.scheduleRebuild()
            host.refreshUi()
          }
          return
        }
        state.draftVerts.push([sx, sy])
        markPreviewDirty(state)
        host.scheduleRebuild()
        host.draw2d()
      }
      return
    }

    if (state.mode === "object") {
      const hit = raycastLevel(ray, level, tris)
      let x = 0
      let y = 0
      let z = 0
      if (hit.kind === "region") {
        x = snapCoord(hit.point.x, state.viewState.gridStep)
        y = snapCoord(hit.point.y, state.viewState.gridStep)
        z = 0
      } else {
        const p = rayFloorIntersection(ray, host.floorDefault())
        if (!p) return
        x = snapCoord(p.x, state.viewState.gridStep)
        y = snapCoord(p.y, state.viewState.gridStep)
      }
      host.beforeEdit()
      level.objects.push({
        type: host.objectType() as import("../../map/levelFormat").ObjectType,
        x,
        y,
        z,
        theta: (host.placeTheta() * Math.PI) / 180,
        pairId: host.placePairId(),
        count: host.enemyCount(),
      })
      state.selection = {
        kind: "object",
        index: level.objects.length - 1
      }
      host.afterEdit()
      markPreviewDirty(state)
      host.scheduleRebuild()
      host.refreshUi()
      return
    }

    if (state.mode === "player") {
      const p = rayFloorIntersection(ray, host.floorDefault())
      if (!p) {
        return
      }
      host.beforeEdit()
      level.player = {
        x: snapCoord(p.x, state.viewState.gridStep),
        y: snapCoord(p.y, state.viewState.gridStep),
        z: level.player?.z ?? 10,
      }
      state.selection = { kind: "player" }
      host.afterEdit()
      markPreviewDirty(state)
      host.scheduleRebuild()
      host.refreshUi()
      return
    }

    const hit = raycastLevel(ray, level, tris, { preferVertices: true })
    if (hit.kind === "vertex") {
      state.selection = {
        kind: "vertex",
        region: hit.region,
        vertex: hit.vertex
      }
      state.drag = {
        kind: "vertex3d",
        region: hit.region,
        vertex: hit.vertex
      }
      host.refreshUi()
      return
    }
    if (hit.kind === "object") {
      if (e.shiftKey) {
        const set = new Set(state.selectedObjects)
        if (set.has(hit.index)) set.delete(hit.index)
        else set.add(hit.index)
        state.selectedObjects = [...set]
        state.selection = {
          kind: "object",
          index: hit.index
        }
      } else {
        state.selectedObjects = [hit.index]
        state.selection = {
          kind: "object", 
          index: hit.index
        }
        if (e.ctrlKey) {
          state.drag = {
            kind: "rotateObject",
            index: hit.index
          }
        } else {
          state.drag = {
            kind: "object3d",
            index: hit.index
          }
        }
      }
      host.refreshUi()
      return
    }
    
    if (hit.kind === "player") {
      state.selection = { kind: "player" }
      host.refreshUi()
      return
    }

    if (hit.kind === "region") {
      state.selection = {
        kind: "region", 
        index: hit.index
      }
      if (e.shiftKey && hit.face === "ceil") {
        state.drag = {
          kind: "heightCeil",
          index: hit.index,
          startZ: level.regions[hit.index].ceil,
          startClientY: e.clientY
        }
      } else if (e.shiftKey) {
        state.drag = {
          kind: "heightFloor",
          index: hit.index,
          startZ: level.regions[hit.index].floor,
          startClientY: e.clientY
        }
      }
      host.refreshUi()
      markPreviewDirty(state)
      host.scheduleRebuild()
      return
    }
    clearSelection(state)
    host.refreshUi()
  }

  const onMove = (e: MouseEvent) => {
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
    const level = currentLevel(state)

    if (state.drag.kind === "orbit") {
      orbitDrag(preview.camera, dx, dy)
      return
    }
    
    if (state.drag.kind === "flyLook") {
      flyLook(preview.camera, dx, dy)
      return
    }

    if (state.drag.kind === "heightFloor") {
      host.beforeEdit()
      const next = state.drag.startZ - dy * 0.15
      level.regions[state.drag.index].floor = snapCoord(next, 1)
      markPreviewDirty(state)
      host.scheduleRebuild()
      host.draw2d()
      return
    }

    if (state.drag.kind === "heightCeil") {
      host.beforeEdit()
      const next = state.drag.startZ - dy * 0.15
      level.regions[state.drag.index].ceil = snapCoord(next, 1)
      markPreviewDirty(state)
      host.scheduleRebuild()
      host.draw2d()
      return
    }

    if (state.drag.kind === "object3d") {
      const { x, y, w, h } = preview.screenToCanvas(e.clientX, e.clientY)
      const ray = screenRay(preview.camera, x, y, w, h)
      const obj = level.objects[state.drag.index]
      const region = level.regions.find((r) => {
        const xs = r.vertices.map((v) => v[0])
        const ys = r.vertices.map((v) => v[1])
        return obj.x >= Math.min(...xs) - 40
      })
      const z = region?.floor ?? host.floorDefault()
      const p = rayFloorIntersection(ray, z)
      if (p) {
        host.beforeEdit()
        obj.x = snapCoord(p.x, state.viewState.gridStep)
        obj.y = snapCoord(p.y, state.viewState.gridStep)
        markPreviewDirty(state)
        host.scheduleRebuild()
        host.draw2d()
      }
      return
    }

    if (state.drag.kind === "vertex3d") {
      const { x, y, w, h } = preview.screenToCanvas(e.clientX, e.clientY)
      const ray = screenRay(preview.camera, x, y, w, h)
      const region = level.regions[state.drag.region]
      const p = rayFloorIntersection(ray, region.floor)
      if (p) {
        host.beforeEdit()
        const snapped = snapVec(p, state.viewState.gridStep)
        region.vertices[state.drag.vertex] = [snapped.x, snapped.y]
        markPreviewDirty(state)
        host.scheduleRebuild()
        host.draw2d()
      }
      return
    }

    if (state.drag.kind === "rotateObject") {
      const obj = level.objects[state.drag.index]
      host.beforeEdit()
      obj.theta = (obj.theta || 0) + dx * 0.01
      markPreviewDirty(state)
      host.scheduleRebuild()
      return
    }

    const { x, y, w, h } = preview.screenToCanvas(e.clientX, e.clientY)
    const ray = screenRay(preview.camera, x, y, w, h)
    const hit = raycastLevel(ray, level, preview.mesh?.tris || [])
    if (hit.kind === "region") {
      host.getStatus().dataset.hover = `R${hit.index + 1} (${hit.point.x.toFixed(0)},${hit.point.y.toFixed(0)},${hit.point.z.toFixed(0)})`
    }
  }

  const onUp = () => {
    if (state.drag.kind !== "none" && state.drag.kind !== "pan" && state.drag.kind !== "orbit" && state.drag.kind !== "flyLook") {
      host.afterEdit()
    }

    state.drag = {
      kind: "none"
    }
  }

  const onKeyDown = (e: KeyboardEvent) => {
    state.keys.add(e.code)
    if (e.code === "KeyF") {
      host.focusSelection()
    }

    if (e.code === "KeyM" && state.selection.kind === "region") {
      const result = measureRegion(currentLevel(state), state.selection.index)
      host.getStatus().textContent = formatMeasure(result)
    }
  }
  
  const onKeyUp = (e: KeyboardEvent) => {
    state.keys.delete(e.code)
  }

  const onCtx = (e: Event) => e.preventDefault()

  canvas.addEventListener("wheel", onWheel, { passive: false })
  canvas.addEventListener("mousedown", onDown)
  window.addEventListener("mousemove", onMove)
  window.addEventListener("mouseup", onUp)
  window.addEventListener("keydown", onKeyDown)
  window.addEventListener("keyup", onKeyUp)
  canvas.addEventListener("contextmenu", onCtx)

  return () => {
    cancelAnimationFrame(raf)
    canvas.removeEventListener("wheel", onWheel)
    canvas.removeEventListener("mousedown", onDown)
    window.removeEventListener("mousemove", onMove)
    window.removeEventListener("mouseup", onUp)
    window.removeEventListener("keydown", onKeyDown)
    window.removeEventListener("keyup", onKeyUp)
    canvas.removeEventListener("contextmenu", onCtx)
  }
}

export function focusSelection3d(state: EditorState, preview: PreviewRenderer): void {
  const level = currentLevel(state)
  if (!preview.mesh) {
    return
  }

  if (state.selection.kind === "region") {
    const r = level.regions[state.selection.index]
    if (!r) {
      return
    }

    const xs = r.vertices.map((v) => v[0])
    const ys = r.vertices.map((v) => v[1])
    focusBounds(preview.camera, { x: Math.min(...xs), y: Math.min(...ys), z: r.floor }, { x: Math.max(...xs), y: Math.max(...ys), z: r.ceil })
    return
  }
  
  if (state.selection.kind === "object") {
    const o = level.objects[state.selection.index]
    focusBounds(preview.camera, {
      x: o.x - 20,
      y: o.y - 20,
      z: 0
    }, {
      x: o.x + 20,
      y: o.y + 20,
      z: 40
    })
    return
  }

  if (state.selection.kind === "player" && level.player) {
    const p = level.player
    focusBounds(preview.camera, {
      x: p.x - 20,
      y: p.y - 20,
      z: 0
    }, {
      x: p.x + 20,
      y: p.y + 20,
      z: 40
    })
    return
  }

  focusBounds(preview.camera, preview.mesh.bounds.min, preview.mesh.bounds.max)
}
