import type { LevelObject } from "../map/levelFormat"
import type { EditorState, EditorCamera } from "./editorState"
import { currentLevel, clearSelection } from "./editorState"
import { getLevelBounds } from "./bounds"
import { nearestEdgeInsert, pickObject, pickPlayer, pickRegion, pickVertex } from "./selection"
import { snapCoord } from "./types"
import type { EditorMode } from "./types"

export function worldFromEvent(e: MouseEvent, canvas: HTMLCanvasElement, camera: EditorCamera, gridStep: number): [number, number] {
  const rect = canvas.getBoundingClientRect()
  const x = (e.clientX - rect.left - camera.panX) / camera.scale
  const y = (e.clientY - rect.top - camera.panY) / camera.scale
  return [snapCoord(x, gridStep), snapCoord(y, gridStep)]
}

export function cursorWorld(e: MouseEvent, canvas: HTMLCanvasElement, camera: EditorCamera, gridStep: number): [number, number] {
  const rect = canvas.getBoundingClientRect()
  const x = snapCoord((e.clientX - rect.left - camera.panX) / camera.scale, gridStep)
  const y = snapCoord((e.clientY - rect.top - camera.panY) / camera.scale, gridStep)
  return [x, y]
}

export function fitCameraToLevel(canvas: HTMLCanvasElement, camera: EditorCamera, level: ReturnType<typeof currentLevel>): void {
  const bounds = getLevelBounds(level)
  const w = canvas.width / devicePixelRatio
  const h = canvas.height / devicePixelRatio
  const contentW = bounds.maxX - bounds.minX
  const contentH = bounds.maxY - bounds.minY
  camera.scale = Math.min(w / contentW, h / contentH, 8)
  camera.panX = w / 2 - ((bounds.minX + bounds.maxX) / 2) * camera.scale
  camera.panY = h / 2 - ((bounds.minY + bounds.maxY) / 2) * camera.scale
}

export function panCameraToWorld(canvas: HTMLCanvasElement, camera: EditorCamera, wx: number, wy: number): void {
  const w = canvas.width / devicePixelRatio
  const h = canvas.height / devicePixelRatio
  camera.panX = w / 2 - wx * camera.scale
  camera.panY = h / 2 - wy * camera.scale
}

export type CanvasInputHost = {
  state: EditorState
  canvas: HTMLCanvasElement
  objectType: () => string
  placeTheta: () => number
  placePairId: () => number
  enemyCount: () => number
  lastPan: { x: number; y: number }
  beforeEdit: () => void
  afterEdit: () => void
  refreshUi: () => void
  draw: () => void
  syncPropsFromSelection: () => void
  refreshValidation: () => void
  deleteSelection: () => void
  closePolygon: () => void
  undo: () => void
  redo: () => void
  copySelection: () => void
  pasteClipboard: () => void
}

export function bindCanvasInput(host: CanvasInputHost): void {
  const { state, canvas } = host
  const { camera } = state

  const onContextMenu = (e: Event) => e.preventDefault()

  const onMouseDown = (e: MouseEvent) => {
    const level = currentLevel(state)

    if (e.button === 1) {
      state.drag = { 
        kind: "pan" 
      }
      host.lastPan = { 
        x: e.clientX, 
        y: e.clientY 
      }
      return
    }

    const [x, y] = worldFromEvent(e, canvas, camera, state.viewState.gridStep)

    if (e.button === 2) {
      const oi = pickObject(level, x, y, camera.scale)
      if (oi >= 0) {
        host.beforeEdit()
        level.objects.splice(oi, 1)
        clearSelection(state)
        host.afterEdit()
        host.refreshUi()
      }
      return
    }

    if (state.mode === "region") {
      if (e.shiftKey && state.selection.kind === "region") {
        host.beforeEdit()
        const vi = nearestEdgeInsert(
          level,
          state.selection.index,
          x,
          y,
          state.viewState.gridStep,
          camera.scale,
        )
        if (vi >= 0) {
          state.selection = { 
            kind: "vertex", 
            region: state.selection.index, 
            vertex: vi 
          }
          host.afterEdit()
          host.refreshUi()
        }
        return
      }
      state.draftVerts.push([x, y])
      host.draw()
      return
    }

    if (state.mode === "object") {
      host.beforeEdit()
      const type = host.objectType()
      const pairRad = (host.placePairId() * Math.PI) / 180
      const rotRad = (host.placeTheta() * Math.PI) / 180
      const obj: LevelObject = {
        type: type as LevelObject["type"],
        x,
        y,
        z: 0,
      }
      if (type === "goal") {
        obj.pairId = pairRad
      } else if (type === "door") {
        obj.pairId = pairRad
        obj.theta = rotRad
      } else {
        obj.theta = rotRad
      }

      if (type === "many") {
        obj.count = Math.max(1, host.enemyCount())
      }

      level.objects.push(obj)
      state.selection = { 
        kind: "object", 
        index: level.objects.length - 1 
      }
      host.afterEdit()
      host.refreshUi()
      return
    }

    if (state.mode === "player") {
      host.beforeEdit()
      level.player = { 
        x, 
        y, 
        z: level.player?.z ?? 10 
      }
      state.selection = { 
        kind: "player" 
      }
      host.afterEdit()
      host.refreshUi()
      return
    }

    const oi = pickObject(level, x, y, camera.scale)
    if (oi >= 0) {
      host.beforeEdit()
      state.selection = { 
        kind: "object", 
        index: oi 
      }
      state.drag = {
        kind: "object", 
        index: oi 
      }
      host.refreshUi()
      return
    }

    if (pickPlayer(level, x, y, camera.scale)) {
      host.beforeEdit()
      state.selection = { 
        kind: "player" 
      }
      state.drag = { 
        kind: "player" 
      }
      host.refreshUi()
      return
    }

    const ri = pickRegion(level, x, y)
    if (ri >= 0) {
      const vi = pickVertex(level, ri, x, y, camera.scale)
      if (vi >= 0) {
        host.beforeEdit()
        state.selection = { 
          kind: "vertex", 
          region: ri, 
          vertex: vi 
        }
        state.drag = { 
          kind: "vertex", 
          region: ri, 
          vertex: vi 
        }
        host.refreshUi()
        return
      }
      host.beforeEdit()
      state.selection = { 
        kind: "region", 
        index: ri 
      }
      state.drag = {
        kind: "region",
        index: ri,
        verts: level.regions[ri].vertices.map((v) => [...v] as [number, number]),
        startX: x,
        startY: y,
      }
      host.refreshUi()
      return
    }

    clearSelection(state)
    host.refreshUi()
  }

  const onMouseMove = (e: MouseEvent) => {
    const level = currentLevel(state)
    const [wx, wy] = cursorWorld(e, canvas, camera, state.viewState.gridStep)

    if (state.drag.kind === "pan") {
      camera.panX += e.clientX - host.lastPan.x
      camera.panY += e.clientY - host.lastPan.y
      host.lastPan = { x: e.clientX, y: e.clientY }
      host.draw()
      return
    }

    if (state.drag.kind === "none") {
      return
    }

    if (state.drag.kind === "object") {
      const obj = level.objects[state.drag.index]
      obj.x = wx
      obj.y = wy
      state.selection = { 
        kind: "object", 
        index: state.drag.index 
      }
      host.syncPropsFromSelection()
      host.draw()
      return
    }

    if (state.drag.kind === "player") {
      level.player = { 
        x: wx, 
        y: wy, 
        z: level.player?.z ?? 10 
      }
      state.selection = { 
        kind: "player" 
      }
      host.syncPropsFromSelection()
      host.draw()
      return
    }

    if (state.drag.kind === "vertex") {
      level.regions[state.drag.region].vertices[state.drag.vertex] = [wx, wy]
      state.selection = { 
        kind: "vertex", 
        region: state.drag.region, 
        vertex: state.drag.vertex 
      }
      host.syncPropsFromSelection()
      host.draw()
      return
    }

    if (state.drag.kind === "region") {
      const dx = wx - state.drag.startX
      const dy = wy - state.drag.startY
      level.regions[state.drag.index].vertices = state.drag.verts.map(([vx, vy]) => [
        snapCoord(vx + dx, state.viewState.gridStep),
        snapCoord(vy + dy, state.viewState.gridStep),
      ] as [number, number])
      state.selection = { 
        kind: "region", 
        index: state.drag.index 
      }
      host.draw()
    }
  }

  const onMouseUp = () => {
    if (state.drag.kind !== "none" && state.drag.kind !== "pan") {
      host.afterEdit()
      host.refreshValidation()
    }
    state.drag = { 
      kind: "none" 
    }
  }

  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const beforeX = (mx - camera.panX) / camera.scale
    const beforeY = (my - camera.panY) / camera.scale
    camera.scale = Math.min(12, Math.max(0.4, camera.scale * (e.deltaY < 0 ? 1.1 : 0.9)))
    camera.panX = mx - beforeX * camera.scale
    camera.panY = my - beforeY * camera.scale
    host.draw()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey
    if (mod && e.key === "z" && !e.shiftKey) {
      e.preventDefault()
      host.undo()
      return
    }

    if (mod && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
      e.preventDefault()
      host.redo()
      return
    }

    if (mod && e.key.toLowerCase() === "c") {
      e.preventDefault()
      host.copySelection()
      return
    }

    if (mod && e.key.toLowerCase() === "v") {
      e.preventDefault()
      host.pasteClipboard()
      return
    }

    if ((e.key === "Delete" || e.key === "Backspace")
      && (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement)) {
      return
    }

    if (e.key === "Escape") {
      state.draftVerts = []
      host.draw()
    }

    if (e.key === "Delete" || e.key === "Backspace") {
      host.deleteSelection()
    }

    if (e.key === "Enter" && state.mode === "region") {
      host.closePolygon()
    }
  }

  canvas.addEventListener("contextmenu", onContextMenu)
  canvas.addEventListener("mousedown", onMouseDown)
  canvas.addEventListener("mousemove", onMouseMove)
  window.addEventListener("mouseup", onMouseUp)
  canvas.addEventListener("wheel", onWheel, { passive: false })
  window.addEventListener("keydown", onKeyDown)
}

export function setEditorMode(state: EditorState, modesEl: HTMLElement, mode: EditorMode, draw: () => void): void {
  state.mode = mode
  modesEl.querySelectorAll("button").forEach((b) => b.classList.remove("active"))
  modesEl.querySelector(`button[data-mode="${mode}"]`)?.classList.add("active")
  state.draftVerts = []
  draw()
}
