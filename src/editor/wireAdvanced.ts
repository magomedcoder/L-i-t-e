import type { Campaign, LevelData, ObjectType } from "../map/levelFormat"
import { REGION_TEXTURE_OPTIONS } from "../map/textures"
import type { MapEntry } from "../map/catalog"
import { t } from "../i18n"
import type { EditorDom } from "./ui"
import type { EditorState } from "./editorState"
import { clearSelection, currentLevel, markPreviewDirty } from "./editorState"
import { PREVIEW_REBUILD_DEBOUNCE_MS } from "./document"
import { createCamera3D, focusBounds } from "./preview/camera3d"
import { createPreviewRenderer, drawOverlay2d, type PreviewRenderer } from "./preview/render3d"
import { bindPreviewInput, focusSelection3d } from "./preview/input3d"
import { analyzeLevel, type ValidationMarkers } from "./validate"
import { extendValidation, type RichIssue } from "./validateExtra"
import { addBookmark, applyBookmark, deleteBookmark, loadBookmarks } from "./bookmarks"
import { makeBoxRoom, makeCorridor, makeRamp } from "./tools/primitives"
import { extrudeRegion, mergeRegions, snapVertexToNearest, splitEdgeInsert } from "./tools/geometryOps"
import { alignObjects, distributeObjects, duplicateObjects, snapObjectsToFloor, snapObjectsToGrid } from "./tools/objectOps"
import { createNewMapDraft, deleteMapDraft, diffDraftVsShipped, duplicateMapDraft, exportLevelJson, importLevelIntoCampaign, listCustomMaps, markPendingApply, mergeCatalogWithCustom, renameMapDraft } from "./mapManager"
import { discardDraft, listRecoverableDrafts, saveDraftWithStamp } from "./recovery"
import { getLevelBounds } from "./bounds"
import type { Selection } from "./types"

export type AdvancedMountApi = {
  preview: PreviewRenderer | null
  scheduleRebuild: () => void
  rebuildNow: () => void
  setLayout: (layout: "split" | "2d" | "3d") => void
  refreshOutliner: () => void
  refreshBookmarks: () => void
  refreshRecovery: () => void
  refreshThumbs: () => void
  refreshTextureBrowser: () => void
  getPlayFromHereCampaign: () => Campaign
  dispose: () => void
  onResize: () => void
  lastIssues: () => RichIssue[]
  analyzeExtended: (
    level: LevelData,
    label: string,
  ) => {
    issues: RichIssue[]
    markers: ValidationMarkers
  }
}

export type AdvancedHost = {
  dom: EditorDom
  state: EditorState
  catalogMaps: () => MapEntry[]
  setCatalogMaps: (maps: MapEntry[]) => void
  beforeEdit: () => void
  afterEdit: () => void
  markDirty: () => void
  refreshUi: () => void
  draw2d: () => void
  persist: (autosave?: boolean) => void
  reload: (mapId: string) => Promise<void>
  fillMapSelect: (maps: MapEntry[], selectedId: string) => void
  onTest: (campaign: Campaign) => void
  syncPropsFromSelection: () => void
}

export function wireAdvancedEditor(host: AdvancedHost): AdvancedMountApi {
  const { dom, state } = host
  let preview: PreviewRenderer | null = null
  let rebuildTimer: ReturnType<typeof setTimeout> | null = null
  let unbindPreview: (() => void) | null = null
  let lastIssues: RichIssue[] = []
  let mergeTarget: number | null = null

  try {
    const cam = createCamera3D()
    preview = createPreviewRenderer(dom.canvas3d, cam)
  } catch (err) {
    console.warn("3D preview unavailable", err)
    dom.fpsStatusEl.textContent = "WebGL2 n/a"
  }

  const meshOpts = () => {
    const sel = state.selection
    return {
      layers: {
        regions: state.viewState.layers.regions,
        objects: state.viewState.layers.objects,
        player: state.viewState.layers.player,
        grid: state.viewState.layers.grid,
        helpers: state.viewState.layers.helpers,
      },
      objectFilter: state.viewState.objectFilter,
      selectedRegion: sel.kind === "region" ? sel.index : sel.kind === "vertex" ? sel.region : undefined,
      selectedObject: sel.kind === "object" ? sel.index : undefined,
      selectedObjects: state.selectedObjects,
      selectedVertex: sel.kind === "vertex" ? { region: sel.region, vertex: sel.vertex } : undefined,
      sectionZ: state.viewState.sectionZ,
      ghostMode: state.viewState.ghostMode,
      draftVerts: state.draftVerts,
      draftFloor: Number(dom.floorEl.value) || 4,
      showLinks: state.viewState.showLinks,
      showAxis: state.viewState.showAxis,
    }
  }

  const rebuildNow = () => {
    if (!preview) {
      return
    }

    const level = currentLevel(state)
    preview.rebuildFromLevel(level, meshOpts())
    state.previewNeedsRebuild = false
    const octx = dom.overlay3d.getContext("2d")
    if (octx) {
      const dpr = devicePixelRatio
      dom.overlay3d.width = dom.overlay3d.clientWidth * dpr
      dom.overlay3d.height = dom.overlay3d.clientHeight * dpr
      octx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const labels: {
        text: string
        world: {
          x: number
          y: number
          z: number
        }; color?: string
      }[] = []
      if (state.selection.kind === "region") {
        const r = level.regions[state.selection.index]
        if (r) {
          const cx = r.vertices.reduce((s, v) => s + v[0], 0) / r.vertices.length
          const cy = r.vertices.reduce((s, v) => s + v[1], 0) / r.vertices.length
          labels.push({
            text: `F ${r.floor}`,
            world: {
              x: cx,
              y: cy,
              z: r.floor + 1
            }
          })
          labels.push({
            text: `C ${r.ceil}`,
            world: {
              x: cx,
              y: cy,
              z: r.ceil - 1
            }
          })
        }
      }
      if (state.measure.last.kind === "distance") {
        const m = state.measure.last
        labels.push({
          text: `Δ${m.length.toFixed(1)}`,
          world: {
            x: (m.a[0] + m.b[0]) / 2,
            y: (m.a[1] + m.b[1]) / 2,
            z: (m.a[2] + m.b[2]) / 2,
          },
        })
      }
      drawOverlay2d(octx, preview.camera, dom.overlay3d.clientWidth, dom.overlay3d.clientHeight, labels)
    }
    dom.fpsStatusEl.textContent = `${preview.fps} fps`
  }

  const scheduleRebuild = () => {
    markPreviewDirty(state)
    if (rebuildTimer) {
      clearTimeout(rebuildTimer)
    }
    rebuildTimer = setTimeout(rebuildNow, PREVIEW_REBUILD_DEBOUNCE_MS)
  }

  const setLayout = (layout: "split" | "2d" | "3d") => {
    state.viewState.layout = layout
    dom.view.classList.toggle("editor-view-split", layout === "split")
    dom.view.classList.toggle("editor-view-2d", layout === "2d")
    dom.view.classList.toggle("editor-view-3d", layout === "3d")
    dom.root.dataset.layout = layout
    dom.layoutSplitBtn.classList.toggle("active", layout === "split")
    dom.layout2dBtn.classList.toggle("active", layout === "2d")
    dom.layout3dBtn.classList.toggle("active", layout === "3d")
    dom.fpsStatusEl.textContent = layout === "2d" ? t("status.previewOff") : `${preview?.fps ?? 0} fps`
    host.draw2d()
    if (layout !== "2d") {
      preview?.resize()
      scheduleRebuild()
    }
  }

  const focusSelection = () => {
    if (preview) {
      focusSelection3d(state, preview)
    }
  }

  const showCtx = (x: number, y: number, _kind: string) => {
    dom.ctxMenuEl.hidden = false
    dom.ctxMenuEl.style.left = `${x}px`
    dom.ctxMenuEl.style.top = `${y}px`
    dom.ctxMenuEl.replaceChildren()
    const add = (label: string, fn: () => void) => {
      const b = document.createElement("button")
      b.type = "button"
      b.textContent = label
      b.onclick = () => {
        dom.ctxMenuEl.hidden = true
        fn()
      }
      dom.ctxMenuEl.append(b)
    }
    add(t("ctx.focus"), focusSelection)
    add(t("ctx.duplicate"), () => {
      if (state.selection.kind === "object") {
        host.beforeEdit()
        const created = duplicateObjects(currentLevel(state), [state.selection.index])
        state.selection = {
          kind: "object",
          index: created[0]
        }
        host.afterEdit()
        host.refreshUi()
        scheduleRebuild()
      } else if (state.selection.kind === "region") {
        host.beforeEdit()
        const src = currentLevel(state).regions[state.selection.index]
        currentLevel(state).regions.push({
          ...structuredClone(src),
          vertices: src.vertices.map(([x, y]) => [x + 8, y + 8] as [number, number]),
        })
        state.selection = {
          kind: "region",
          index: currentLevel(state).regions.length - 1
        }
        host.afterEdit()
        host.refreshUi()
        scheduleRebuild()
      }
    })
    add(t("ctx.delete"), () => {
      const ev = new KeyboardEvent("keydown", { key: "Delete" })
      window.dispatchEvent(ev)
    })
    if (state.selection.kind === "object") {
      const obj = currentLevel(state).objects[state.selection.index]
      if (obj?.type === "goal" || obj?.type === "door") {
        add(t("ctx.goToPair"), () => {
          const pair = obj.pairId ?? obj.theta ?? 0
          const idx = currentLevel(state).objects.findIndex((o, i) => i !== (state.selection as Extract<Selection, { kind: "object" }>).index && (o.type === "goal" || o.type === "door") && (o.pairId ?? o.theta ?? 0) === pair)
          if (idx >= 0) {
            state.selection = {
              kind: "object",
              index: idx
            }
            host.refreshUi()
            focusSelection()
          }
        })
      }
    }
  }

  if (preview) {
    unbindPreview = bindPreviewInput({
      state,
      preview,
      overlay: dom.overlay3d,
      objectType: () => dom.objectTypeEl.value,
      placeTheta: () => Number(dom.placeThetaEl.value) || 0,
      placePairId: () => Number(dom.placePairIdEl.value) || 0,
      enemyCount: () => Math.max(1, Number(dom.selCountEl.value) || 1),
      floorDefault: () => Number(dom.floorEl.value) || 4,
      ceilDefault: () => Number(dom.ceilEl.value) || 40,
      beforeEdit: host.beforeEdit,
      afterEdit: host.afterEdit,
      refreshUi: host.refreshUi,
      draw2d: host.draw2d,
      scheduleRebuild,
      focusSelection,
      getStatus: () => dom.statusBarEl,
      onContextMenu: showCtx,
    })
  }

  const refreshOutliner = () => {
    const q = dom.outlinerSearchEl.value.trim().toLowerCase()
    const level = currentLevel(state)
    const nodes: HTMLElement[] = []
    const addNode = (label: string, active: boolean, onClick: () => void) => {
      if (q && !label.toLowerCase().includes(q)) {
        return
      }
      const b = document.createElement("button")
      b.type = "button"
      b.textContent = label
      b.className = active ? "active" : ""
      b.onclick = onClick
      nodes.push(b)
    }
    addNode(`L${state.levelIndex + 1}: ${level.name || t("level.unnamed")}`, false, () => undefined)
    level.regions.forEach((r, i) => {
      const id = r.id ? ` #${r.id}` : ""
      addNode(`R${i + 1}${id} (${r.vertices.length}v)`, state.selection.kind === "region" && state.selection.index === i, () => {
        state.selection = {
          kind: "region",
          index: i
        }
        host.refreshUi()
        focusSelection()
      })
    })
    level.objects.forEach((o, i) => {
      addNode(`O${i + 1} ${o.type}`, state.selection.kind === "object" && state.selection.index === i, () => {
        state.selection = {
          kind: "object",
          index: i
        }
        host.refreshUi()
        focusSelection()
      })
    })
    if (level.player) {
      addNode("Player", state.selection.kind === "player", () => {
        state.selection = { kind: "player" }
        host.refreshUi()
        focusSelection()
      })
    }
    dom.outlinerEl.replaceChildren(...nodes)
  }

  const refreshBookmarks = () => {
    const list = loadBookmarks(state.mapId).filter((b) => b.levelIndex === state.levelIndex)
    dom.bookmarksEl.replaceChildren(
      ...list.map((bm) => {
        const row = document.createElement("div")
        row.className = "bookmark-row"
        const go = document.createElement("button")
        go.type = "button"
        go.textContent = bm.name
        go.onclick = () => {
          if (preview) {
            applyBookmark(preview.camera, bm)
          }
        }
        const del = document.createElement("button")
        del.type = "button"
        del.textContent = "X"
        del.onclick = () => {
          deleteBookmark(state.mapId, bm.id)
          refreshBookmarks()
        }
        row.append(go, del)
        return row
      }),
    )
  }

  const refreshRecovery = () => {
    const drafts = listRecoverableDrafts(host.catalogMaps())
    dom.recoveryListEl.replaceChildren(
      ...drafts.map((d) => {
        const row = document.createElement("div")
        row.className = "recovery-row"
        const open = document.createElement("button")
        open.type = "button"
        open.textContent = `${d.name} (${Math.round(d.size / 1024)}kb)`
        open.onclick = () => void host.reload(d.mapId)
        const discard = document.createElement("button")
        discard.type = "button"
        discard.textContent = t("action.discardDraft")
        discard.onclick = () => {
          if (confirm(t("confirm.discardDraft"))) {
            discardDraft(d.mapId)
            refreshRecovery()
          }
        }
        row.append(open, discard)
        return row
      }),
    )
  }

  const refreshThumbs = () => {
    dom.levelThumbsEl.replaceChildren(
      ...state.campaign.levels.map((level, i) => {
        const btn = document.createElement("button")
        btn.type = "button"
        btn.className = i === state.levelIndex ? "active thumb" : "thumb"
        const c = document.createElement("canvas")
        c.width = 96
        c.height = 64
        const ctx = c.getContext("2d")!
        ctx.fillStyle = "#0b0d12"
        ctx.fillRect(0, 0, 96, 64)
        const bounds = getLevelBounds(level, 8)
        const bw = bounds.maxX - bounds.minX || 1
        const bh = bounds.maxY - bounds.minY || 1
        const sc = Math.min(90 / bw, 58 / bh)
        ctx.strokeStyle = "#6a7a9a"
        level.regions.forEach((r) => {
          ctx.beginPath()
          r.vertices.forEach(([x, y], vi) => {
            const px = 3 + (x - bounds.minX) * sc
            const py = 3 + (y - bounds.minY) * sc
            if (vi === 0) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
          })
          ctx.closePath()
          ctx.stroke()
        })
        btn.append(c, document.createTextNode(level.name || `${i + 1}`))
        btn.onclick = () => {
          state.levelIndex = i
          clearSelection(state)
          host.refreshUi()
          scheduleRebuild()
          if (preview?.mesh) {
            focusBounds(preview.camera, preview.mesh.bounds.min, preview.mesh.bounds.max)
          }
        }
        return btn
      }),
    )
  }

  const refreshTextureBrowser = () => {
    dom.textureBrowserEl.replaceChildren(
      ...REGION_TEXTURE_OPTIONS.map((opt) => {
        const b = document.createElement("button")
        b.type = "button"
        b.className = "texture-swatch"
        b.dataset.value = String(opt.value)
        b.title = t(opt.labelKey)
        b.textContent = opt.value == null ? "A" : String(opt.value)
        b.onclick = () => {
          if (state.selection.kind !== "region") return
          host.beforeEdit()
          const r = currentLevel(state).regions[state.selection.index]
          r.texture = opt.value === "" || opt.value == null ? undefined : Number(opt.value)
          dom.regionTextureEl.value = opt.value == null || opt.value === "" ? "" : String(opt.value)
          host.afterEdit()
          scheduleRebuild()
          host.refreshUi()
        }
        return b
      }),
    )
  }

  dom.layoutSplitBtn.addEventListener("click", () => setLayout("split"))
  dom.layout2dBtn.addEventListener("click", () => setLayout("2d"))
  dom.layout3dBtn.addEventListener("click", () => setLayout("3d"))

  dom.layerGridEl.addEventListener("change", () => {
    state.viewState.layers.grid = dom.layerGridEl.checked
    scheduleRebuild()
  })
  dom.layerHelpersEl.addEventListener("change", () => {
    state.viewState.layers.helpers = dom.layerHelpersEl.checked
    scheduleRebuild()
  })
  dom.ghostModeEl.addEventListener("change", () => {
    state.viewState.ghostMode = dom.ghostModeEl.checked
    scheduleRebuild()
  })
  dom.sectionZEl.addEventListener("change", () => {
    const v = dom.sectionZEl.value
    state.viewState.sectionZ = v === "" ? null : Number(v)
    scheduleRebuild()
  })
  dom.showLinksEl.addEventListener("change", () => {
    state.viewState.showLinks = dom.showLinksEl.checked
    scheduleRebuild()
  })
  dom.showAxisEl.addEventListener("change", () => {
    state.viewState.showAxis = dom.showAxisEl.checked
    scheduleRebuild()
  })

  dom.helpBtn.addEventListener("click", () => {
    dom.cheatSheetEl.hidden = !dom.cheatSheetEl.hidden
  })
  dom.cheatSheetEl.addEventListener("click", (e) => {
    if (e.target === dom.cheatSheetEl) dom.cheatSheetEl.hidden = true
  })

  document.addEventListener("click", () => {
    dom.ctxMenuEl.hidden = true
  })

  dom.addBookmarkBtn.addEventListener("click", () => {
    if (!preview) {
      return
    }
    
    const name = prompt(t("prompt.bookmarkName"), `View ${loadBookmarks(state.mapId).length + 1}`)
    if (!name) {
      return
    }
    addBookmark(state.mapId, state.levelIndex, name, preview.camera)
    refreshBookmarks()
  })

  dom.outlinerSearchEl.addEventListener("input", refreshOutliner)

  dom.primitivesEl.querySelectorAll<HTMLButtonElement>("button[data-primitive]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.dataset.primitive
      const level = currentLevel(state)
      const bounds = getLevelBounds(level)
      const cx = (bounds.minX + bounds.maxX) / 2
      const cy = (bounds.minY + bounds.maxY) / 2
      host.beforeEdit()
      if (kind === "box") {
        level.regions.push(makeBoxRoom(cx + 40, cy, 64, Number(dom.floorEl.value) || 4, Number(dom.ceilEl.value) || 40, state.viewState.gridStep))
      } else if (kind === "corridor") {
        level.regions.push(makeCorridor(cx, cy, cx + 80, cy, 24, Number(dom.floorEl.value) || 4, Number(dom.ceilEl.value) || 40, state.viewState.gridStep))
      } else if (kind === "ramp") {
        level.regions.push(...makeRamp(cx + 40, cy + 40, 64, 32, 4, 20, 44, 4, state.viewState.gridStep))
      }
      state.selection = { kind: "region", index: level.regions.length - 1 }
      host.afterEdit()
      host.refreshUi()
      scheduleRebuild()
    })
  })

  dom.extrudeBtn.addEventListener("click", () => {
    if (state.selection.kind !== "region") {
      return
    }
    host.beforeEdit()
    const ni = extrudeRegion(currentLevel(state), state.selection.index, 16)
    if (ni >= 0) {
      state.selection = {
        kind: "region",
        index: ni
      }
    }
    host.afterEdit()
    host.refreshUi()
    scheduleRebuild()
  })

  dom.mergeBtn.addEventListener("click", () => {
    if (state.selection.kind !== "region") {
      return
    }
    if (mergeTarget == null) {
      mergeTarget = state.selection.index
      dom.mergeBtn.textContent = t("action.mergePick")
      return
    }
    host.beforeEdit()
    const ok = mergeRegions(currentLevel(state), mergeTarget, state.selection.index)
    mergeTarget = null
    dom.mergeBtn.textContent = t("action.merge")
    if (ok) {
      clearSelection(state)
    }
    host.afterEdit()
    host.refreshUi()
    scheduleRebuild()
  })

  dom.snapVertBtn.addEventListener("click", () => {
    if (state.selection.kind !== "vertex") {
      return
    }
    host.beforeEdit()
    snapVertexToNearest(currentLevel(state), state.selection.region, state.selection.vertex)
    host.afterEdit()
    scheduleRebuild()
    host.refreshUi()
  })

  dom.splitEdgeBtn.addEventListener("click", () => {
    if (state.selection.kind !== "region") {
      return
    }
    host.beforeEdit()
    splitEdgeInsert(currentLevel(state), state.selection.index, 0, state.viewState.gridStep)
    host.afterEdit()
    scheduleRebuild()
    host.refreshUi()
  })

  const selectedObjIndices = () => state.selectedObjects.length
    ? state.selectedObjects
    : state.selection.kind === "object" ? [state.selection.index] : []

  dom.alignXBtn.addEventListener("click", () => {
    const idx = selectedObjIndices()
    if (!idx.length) {
      return
    }
    host.beforeEdit()
    alignObjects(currentLevel(state), idx, "x")
    host.afterEdit()
    scheduleRebuild()
    host.refreshUi()
  })
  dom.alignYBtn.addEventListener("click", () => {
    const idx = selectedObjIndices()
    if (!idx.length) {
      return
    }
    host.beforeEdit()
    alignObjects(currentLevel(state), idx, "y")
    host.afterEdit()
    scheduleRebuild()
    host.refreshUi()
  })
  dom.distributeXBtn.addEventListener("click", () => {
    const idx = selectedObjIndices()
    if (idx.length < 3) {
      return
    }
    host.beforeEdit()
    distributeObjects(currentLevel(state), idx, "x")
    host.afterEdit()
    scheduleRebuild()
    host.refreshUi()
  })
  dom.snapGridBtn.addEventListener("click", () => {
    const idx = selectedObjIndices()
    if (!idx.length) {
      return
    }
    host.beforeEdit()
    snapObjectsToGrid(currentLevel(state), idx, state.viewState.gridStep)
    host.afterEdit()
    scheduleRebuild()
    host.refreshUi()
  })
  dom.snapFloorBtn.addEventListener("click", () => {
    const idx = selectedObjIndices()
    if (!idx.length) {
      return
    }
    host.beforeEdit()
    snapObjectsToFloor(currentLevel(state), idx)
    host.afterEdit()
    scheduleRebuild()
    host.refreshUi()
  })

  dom.levelNotesEl.addEventListener("change", () => {
    currentLevel(state).notes = dom.levelNotesEl.value
    host.markDirty()
  })
  dom.levelTagsEl.addEventListener("change", () => {
    currentLevel(state).tags = dom.levelTagsEl.value.split(",").map((s) => s.trim()).filter(Boolean)
    host.markDirty()
  })

  dom.exportLevelBtn.addEventListener("click", () => {
    const blob = new Blob([exportLevelJson(currentLevel(state))], { type: "application/json" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `${currentLevel(state).name || "level"}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  })
  dom.importLevelBtn.addEventListener("click", () => dom.levelFileEl.click())
  dom.levelFileEl.addEventListener("change", async () => {
    const file = dom.levelFileEl.files?.[0]
    dom.levelFileEl.value = ""
    if (!file) {
      return
    }
    try {
      host.beforeEdit()
      importLevelIntoCampaign(state.campaign, JSON.parse(await file.text()))
      state.levelIndex = state.campaign.levels.length - 1
      host.afterEdit()
      host.refreshUi()
      scheduleRebuild()
    } catch (err) {
      alert(String(err))
    }
  })

  dom.newMapBtn.addEventListener("click", () => {
    const name = prompt(t("prompt.newMapName"), "New map")
    if (!name) {
      return
    }
    host.persist(true)
    const { id } = createNewMapDraft(name)
    const maps = mergeCatalogWithCustom(host.catalogMaps())
    host.setCatalogMaps(maps)
    host.fillMapSelect(maps, id)
    void host.reload(id)
  })
  dom.renameMapBtn.addEventListener("click", () => {
    const name = prompt(t("prompt.renameMap"), state.campaign.name || state.mapId)
    if (!name) {
      return
    }
    renameMapDraft(state.mapId, name, state.campaign)
    host.markDirty()
    host.refreshUi()
  })
  dom.dupMapBtn.addEventListener("click", () => {
    host.persist(true)
    const { id } = duplicateMapDraft(state.mapId, state.campaign)
    const maps = mergeCatalogWithCustom(host.catalogMaps())
    host.setCatalogMaps(maps)
    host.fillMapSelect(maps, id)
    void host.reload(id)
  })
  dom.delMapBtn.addEventListener("click", () => {
    if (!state.mapId.startsWith("custom_")) {
      alert(t("alert.onlyCustomDelete"))
      return
    }
    if (!confirm(t("confirm.deleteMap"))) {
      return
    }
    deleteMapDraft(state.mapId)
    const maps = mergeCatalogWithCustom(host.catalogMaps().filter((m) => m.id !== state.mapId))
    host.setCatalogMaps(maps)
    const next = maps[0]?.id || "default"
    host.fillMapSelect(maps, next)
    void host.reload(next)
  })

  dom.diffBtn.addEventListener("click", async () => {
    const result = await diffDraftVsShipped(state.mapId, state.campaign, host.catalogMaps())
    dom.diffStatusEl.textContent = result.summary
  })

  const origApply = dom.applyGameBtn.onclick
  dom.applyGameBtn.addEventListener("click", () => {
    markPendingApply(state.mapId, state.campaign)
    void origApply
  })

  window.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
      return
    }

    if (e.key === "?") {
      dom.cheatSheetEl.hidden = !dom.cheatSheetEl.hidden
    }

    const modeByDigit: Record<string, string> = {
      "1": "select",
      "2": "region",
      "3": "object",
      "4": "player",
      "5": "measure",
    }

    if (modeByDigit[e.key]) {
      const btn = dom.modesEl.querySelector(`button[data-mode="${modeByDigit[e.key]}"]`) as HTMLButtonElement | null
      btn?.click()
    }

    if (e.key === "h" || e.key === "H") {
      dom.ghostModeEl.checked = !dom.ghostModeEl.checked
      state.viewState.ghostMode = dom.ghostModeEl.checked
      scheduleRebuild()
    }

    if (e.key === "g" || e.key === "G") {
      dom.layerGridEl.checked = !dom.layerGridEl.checked
      state.viewState.layers.grid = dom.layerGridEl.checked
      scheduleRebuild()
    }

    if (e.key === "e" || e.key === "E") {
      if (state.selection.kind === "region" && !e.ctrlKey) {
        dom.extrudeBtn.click()
      }
    }

    if (e.key === "b" || e.key === "B") {
      (dom.primitivesEl.querySelector('[data-primitive="box"]') as HTMLButtonElement | null)?.click()
    }
  })

  setLayout(state.viewState.layout)
  refreshTextureBrowser()
  refreshBookmarks()
  refreshRecovery()
  refreshThumbs()
  refreshOutliner()
  scheduleRebuild()

  const analyzeExtended = (level: LevelData, label: string) => {
    const base = analyzeLevel(level, label)
    const ext = extendValidation(level, base.issues, base.markers)
    lastIssues = ext.issues
    return ext
  }

  return {
    preview,
    scheduleRebuild,
    rebuildNow,
    setLayout,
    refreshOutliner,
    refreshBookmarks,
    refreshRecovery,
    refreshThumbs,
    refreshTextureBrowser,
    getPlayFromHereCampaign: () => {
      host.persist(true)
      const level = structuredClone(currentLevel(state))
      if (preview) {
        const eye = preview.camera.mode === "fly" && preview.camera.eye
          ? preview.camera.eye
          : preview.camera.target
        level.player = {
          x: eye.x,
          y: eye.y,
          z: eye.z,
        }
      }
      return {
        name: state.campaign.name,
        author: state.campaign.author,
        difficulty: state.campaign.difficulty,
        levels: [level],
      }
    },
    dispose: () => {
      unbindPreview?.()
      preview?.dispose()
      if (rebuildTimer) clearTimeout(rebuildTimer)
    },
    onResize: () => {
      preview?.resize()
      rebuildNow()
    },
    lastIssues: () => lastIssues,
    analyzeExtended,
  }
}

export type { ObjectType }
export { listCustomMaps, saveDraftWithStamp }
