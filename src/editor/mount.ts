import { clearCampaignDraft, fetchCampaignFile, loadEditorCampaign, rememberSelectedMapId } from "../map/catalog"
import type { MapEntry } from "../map/catalog"
import { type Campaign, parseCampaignText } from "../map/levelFormat"
import { t, onLocaleChange } from "../i18n"
import { fillMapSelect } from "../ui/maps"
import { button } from "../ui/el"
import { drawEditorLevel, drawGrid } from "./draw"
import { emptyLevel } from "./helpers"
import { createHistory } from "./history"
import { getLevelBounds } from "./bounds"
import { drawMinimap, minimapWorldFromEvent } from "./minimap"
import { clearSelection, createEditorState, currentLevel, editorSnapshot, markPreviewDirty, type EditorState } from "./editorState"
import { focusSelection3d } from "./preview/input3d"
import { saveDraftWithStamp, wireAdvancedEditor, type AdvancedMountApi } from "./wireAdvanced"
import type { FocusTarget } from "./validateExtra"
import { bindCanvasInput, cursorWorld, fitCameraToLevel, panCameraToWorld, setEditorMode } from "./input"
import { applyObjectProps, applyPlayerProps, applyRegionProps, syncPropsFromSelection, type PropertiesHost } from "./properties"
import type { EditorDom } from "./ui"
import { DEFAULT_GRID_STEP } from "./types"
const PAIR_PRESETS_DEG = [0, 90, 180, 270]

export function mountEditor(
  dom: EditorDom,
  options: { onTest?: (campaign: Campaign) => void } = {},
) {
  const state = createEditorState()
  let catalogMaps: MapEntry[] = []
  let syncingProps = { value: false }
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null
  let editRecorded = false
  const history = createHistory()
  const lastPan = { x: 0, y: 0 }
  let advanced!: AdvancedMountApi

  const {
    canvas,
    view,
    mapSelectEl,
    modesEl,
    objectTypeEl,
    placeThetaEl,
    placePairIdEl,
    floorEl,
    ceilEl,
    campaignNameEl,
    campaignAuthorEl,
    campaignDifficultyEl,
    levelNameEl,
    levelListEl,
    fileEl,
    closePolyBtn,
    deleteSelBtn,
    addLevelBtn,
    dupLevelBtn,
    delLevelBtn,
    saveStorageBtn,
    exportJsonBtn,
    importJsonBtn,
    resetDefaultBtn,
    fitLevelBtn,
    selTypeEl,
    selXEl,
    selYEl,
    selZEl,
    selPairIdEl,
    selRotationEl,
    selCountEl,
    pairPresetsEl,
    playerXEl,
    playerYEl,
    playerZEl,
    validateListEl,
    testLevelBtn,
    testCampaignBtn,
    statusBarEl,
    regionListEl,
    objectListEl,
    dirtyIndicatorEl,
    minimapCanvas,
    layerRegionsEl,
    layerObjectsEl,
    layerPlayerEl,
    objectFilterEl,
    gridStepEl,
    applyGameBtn,
  } = dom

  const ctx2d = canvas.getContext("2d")!
  const minimapCtx = minimapCanvas.getContext("2d")!

  PAIR_PRESETS_DEG.forEach((deg) => {
    pairPresetsEl.append(
      button(`${deg}°`, {
        type: "button",
        className: "pair-preset",
        dataset: { deg: String(deg) },
      }),
    )
  })

  const propsHost: PropertiesHost = {
    dom,
    level: () => currentLevel(state),
    selection: () => state.selection,
    syncingProps,
    onObjectChange: () => {
      refreshValidation()
      markDirty()
      markPreviewDirty(state)
      draw()
    },
    onPlayerChange: () => {
      refreshValidation()
      markDirty()
      markPreviewDirty(state)
      draw()
    },
    onRegionChange: () => {
      markDirty()
      markPreviewDirty(state)
      refreshEntityLists()
      draw()
    },
  }

  const applyIssueFocus = (focus: FocusTarget) => {
    if (focus.kind === "region") {
      state.selection = { kind: "region", index: focus.index }
      state.selectedObjects = []
    } else if (focus.kind === "object") {
      state.selection = { kind: "object", index: focus.index }
      state.selectedObjects = [focus.index]
    } else if (focus.kind === "player") {
      state.selection = { kind: "player" }
      state.selectedObjects = []
    } else {
      clearSelection(state)
    }

    syncPropsFromSelection(propsHost)
    if (advanced?.preview) {
      focusSelection3d(state, advanced.preview)
    }
    refreshEntityLists()
    draw()
  }

  const syncViewControls = () => {
    layerRegionsEl.checked = state.viewState.layers.regions
    layerObjectsEl.checked = state.viewState.layers.objects
    layerPlayerEl.checked = state.viewState.layers.player
    dom.layerGridEl.checked = state.viewState.layers.grid
    dom.layerHelpersEl.checked = state.viewState.layers.helpers
    objectFilterEl.value = state.viewState.objectFilter
    gridStepEl.value = String(state.viewState.gridStep)
    dom.ghostModeEl.checked = state.viewState.ghostMode
    dom.sectionZEl.value = state.viewState.sectionZ != null ? String(state.viewState.sectionZ) : ""
    dom.showLinksEl.checked = state.viewState.showLinks
    dom.showAxisEl.checked = state.viewState.showAxis
  }

  const drawMinimapPanel = () => {
    const bounds = getLevelBounds(currentLevel(state), 0)
    const dpr = devicePixelRatio
    const mmW = 160
    const mmH = 110
    minimapCanvas.width = mmW * dpr
    minimapCanvas.height = mmH * dpr
    minimapCanvas.style.width = `${mmW}px`
    minimapCanvas.style.height = `${mmH}px`
    minimapCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawMinimap(minimapCtx, currentLevel(state), bounds, {
      panX: state.camera.panX,
      panY: state.camera.panY,
      scale: state.camera.scale,
      viewW: canvas.width / dpr,
      viewH: canvas.height / dpr,
    })
  }

  const updateStatusBar = (wx?: number, wy?: number) => {
    statusBarEl.textContent = wx != null && wy != null
      ? t("status.cursor", { x: wx, y: wy })
      : ""
  }

  const draw = () => {
    const w = canvas.width / devicePixelRatio
    const h = canvas.height / devicePixelRatio
    const { camera } = state
    ctx2d.clearRect(0, 0, w, h)
    ctx2d.fillStyle = "#0b0d12"
    ctx2d.fillRect(0, 0, w, h)
    ctx2d.save()
    ctx2d.translate(camera.panX, camera.panY)
    ctx2d.scale(camera.scale, camera.scale)
    drawGrid(ctx2d, camera.scale, state.viewState.gridStep)
    drawEditorLevel(ctx2d, currentLevel(state), state.draftVerts, state.selection, camera.scale, {
      markers: state.markers,
      layers: state.viewState.layers,
      objectFilter: state.viewState.objectFilter,
      gridStep: state.viewState.gridStep,
    })
    ctx2d.restore()
    drawMinimapPanel()
    if (state.previewNeedsRebuild) {
      advanced?.scheduleRebuild()
    } else if (advanced?.preview) {
      dom.fpsStatusEl.textContent = `${advanced.preview.fps} fps`
    }
  }

  const resize = () => {
    canvas.width = view.clientWidth * devicePixelRatio
    canvas.height = view.clientHeight * devicePixelRatio
    ctx2d.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
    draw()
    advanced?.onResize()
  }

  const refreshValidation = () => {
    const label = currentLevel(state).name || t("level.numbered", { n: state.levelIndex + 1 })
    if (!advanced) {
      return
    }
    const result = advanced.analyzeExtended(currentLevel(state), label)
    state.markers = result.markers
    validateListEl.replaceChildren(
      ...result.issues.map((issue) => {
        const li = document.createElement("li")
        li.className = issue.level
        li.textContent = issue.message
        li.style.cursor = issue.focus.kind === "none" ? "" : "pointer"
        if (issue.focus.kind !== "none") {
          li.onclick = () => applyIssueFocus(issue.focus)
        }
        return li
      }),
    )
  }

  const refreshEntityLists = () => {
    const lvl = currentLevel(state)
    regionListEl.replaceChildren(
      ...lvl.regions.map((region, i) => {
        const b = document.createElement("button")
        b.type = "button"
        const suffix = region.id ? ` (${region.id})` : ""
        b.textContent = `${i + 1}. ${region.vertices.length} ${t("label.vertex").toLowerCase()}${suffix}`
        b.className = state.selection.kind === "region" && state.selection.index === i ? "active" : ""
        b.onclick = () => {
          state.selection = { kind: "region", index: i }
          refreshUi()
        }
        return b
      }),
    )
    objectListEl.replaceChildren(
      ...lvl.objects
        .map((obj, i) => ({ obj, i }))
        .filter(({ obj }) => !state.viewState.objectFilter || obj.type === state.viewState.objectFilter)
        .map(({ obj, i }) => {
          const b = document.createElement("button")
          b.type = "button"
          b.textContent = `${i + 1}. ${obj.type}`
          b.className = state.selection.kind === "object" && state.selection.index === i ? "active" : ""
          b.onclick = () => {
            state.selection = { kind: "object", index: i }
            refreshUi()
          }
          return b
        }),
    )
  }

  const updateDirtyUi = (saved = false) => {
    dirtyIndicatorEl.hidden = !state.dirty
    dirtyIndicatorEl.title = state.dirty ? t("status.dirty") : saved ? t("status.saved") : ""
    dirtyIndicatorEl.style.color = saved ? "#3ecf8e" : state.dirty ? "#ffcc66" : ""
  }

  const markDirty = () => {
    state.dirty = true
    updateDirtyUi()
    if (autosaveTimer) {
      clearTimeout(autosaveTimer)
    }
    autosaveTimer = setTimeout(() => persist(true), 1500)
  }

  const beforeEdit = () => {
    if (!editRecorded) {
      history.push(state.campaign, state.levelIndex, state.selection, state.selectedObjects)
      editRecorded = true
    }
  }

  const afterEdit = () => {
    editRecorded = false
    markDirty()
    markPreviewDirty(state)
    advanced?.scheduleRebuild()
  }

  const applySnapshot = (snap: ReturnType<typeof editorSnapshot>) => {
    state.campaign = structuredClone(snap.campaign)
    state.levelIndex = snap.levelIndex
    state.selection = structuredClone(snap.selection)
    state.selectedObjects = [...(snap.selectedObjects || [])]
    markPreviewDirty(state)
  }

  const refreshUi = () => {
    campaignNameEl.value = state.campaign.name || ""
    campaignAuthorEl.value = state.campaign.author || ""
    campaignDifficultyEl.value = String(state.campaign.difficulty ?? 1)
    levelNameEl.value = currentLevel(state).name || ""
    dom.levelNotesEl.value = currentLevel(state).notes || ""
    dom.levelTagsEl.value = (currentLevel(state).tags || []).join(", ")
    levelListEl.replaceChildren(
      ...state.campaign.levels.map((l, i) => {
        const b = document.createElement("button")
        b.type = "button"
        b.textContent = `${i + 1}. ${l.name || t("level.unnamed")}`
        b.className = i === state.levelIndex ? "active" : ""
        b.onclick = () => {
          state.levelIndex = i
          clearSelection(state)
          state.draftVerts = []
          refreshUi()
        }
        return b
      }),
    )
    syncPropsFromSelection(propsHost)
    syncViewControls()
    refreshEntityLists()
    refreshValidation()
    advanced?.refreshOutliner()
    advanced?.refreshBookmarks()
    advanced?.refreshThumbs()
    draw()
  }

  const reload = async (nextMapId: string) => {
    state.mapId = nextMapId
    state.campaign = await loadEditorCampaign(nextMapId)
    state.levelIndex = 0
    clearSelection(state)
    state.draftVerts = []
    history.clear()
    state.dirty = false
    updateDirtyUi()
    mapSelectEl.value = state.mapId
    refreshUi()
    resize()
  }

  const getTestCampaign = (allLevels: boolean): Campaign => {
    persist(true)
    if (allLevels) {
      return structuredClone(state.campaign)
    }
    return {
      name: state.campaign.name,
      author: state.campaign.author,
      difficulty: state.campaign.difficulty,
      levels: [structuredClone(currentLevel(state))],
    }
  }

  const copySelection = () => {
    const lvl = currentLevel(state)
    if (state.selectedObjects.length > 1) {
      state.clipboard = {
        kind: "objects",
        data: state.selectedObjects.map((i) => structuredClone(lvl.objects[i])),
      }
      return
    }

    if (state.selection.kind === "object") {
      state.clipboard = {
        kind: "object",
        data: structuredClone(lvl.objects[state.selection.index]),
      }
    } else if (state.selection.kind === "region") {
      state.clipboard = {
        kind: "region",
        data: structuredClone(lvl.regions[state.selection.index]),
      }
    }
  }

  const pasteClipboard = () => {
    const clip = state.clipboard
    if (!clip) {
      return
    }

    beforeEdit()
    const lvl = currentLevel(state)
    if (clip.kind === "object") {
      const obj = structuredClone(clip.data)
      obj.x += 8
      obj.y += 8
      lvl.objects.push(obj)
      state.selection = { kind: "object", index: lvl.objects.length - 1 }
      state.selectedObjects = [state.selection.index]
    } else if (clip.kind === "region") {
      const region = structuredClone(clip.data)
      region.vertices = region.vertices.map(([x, y]) => [x + 8, y + 8] as [number, number])
      lvl.regions.push(region)
      state.selection = {
        kind: "region",
        index: lvl.regions.length - 1
      }
      state.selectedObjects = []
    } else if (clip.kind === "objects") {
      const newIndices: number[] = []
      for (const src of clip.data) {
        const obj = structuredClone(src)
        obj.x += 8
        obj.y += 8
        lvl.objects.push(obj)
        newIndices.push(lvl.objects.length - 1)
      }
      state.selectedObjects = newIndices
      state.selection = {
        kind: "object",
        index: newIndices[newIndices.length - 1]!
      }
    }
    afterEdit()
    refreshUi()
  }

  const undo = () => {
    const prev = history.undo(editorSnapshot(state))
    if (!prev) {
      return
    }
    applySnapshot(prev)
    state.dirty = true
    updateDirtyUi()
    refreshUi()
  }

  const redo = () => {
    const next = history.redo(editorSnapshot(state))
    if (!next) {
      return
    }
    applySnapshot(next)
    state.dirty = true
    updateDirtyUi()
    refreshUi()
  }

  const fillEditorMapSelect = (maps: MapEntry[], selectedId: string) => {
    catalogMaps = maps
    fillMapSelect(mapSelectEl, maps, selectedId)
  }

  const closePoly = () => {
    if (state.draftVerts.length < 3) {
      return
    }
    beforeEdit()
    currentLevel(state).regions.push({
      vertices: [...state.draftVerts],
      floor: Number(floorEl.value) || 4,
      ceil: Number(ceilEl.value) || 40,
    })
    state.selection = { kind: "region", index: currentLevel(state).regions.length - 1 }
    state.draftVerts = []
    afterEdit()
    refreshUi()
  }

  const deleteSelection = () => {
    if (state.selection.kind === "none") {
      return
    }
    beforeEdit()
    if (state.selection.kind === "object") {
      currentLevel(state).objects.splice(state.selection.index, 1)
      clearSelection(state)
    } else if (state.selection.kind === "region") {
      currentLevel(state).regions.splice(state.selection.index, 1)
      clearSelection(state)
    } else if (state.selection.kind === "vertex") {
      const verts = currentLevel(state).regions[state.selection.region].vertices
      if (verts.length > 3) {
        verts.splice(state.selection.vertex, 1)
        state.selection = { kind: "region", index: state.selection.region }
      }
    }
    afterEdit()
    refreshUi()
  }

  const persist = (autosave = false) => {
    state.campaign.name = campaignNameEl.value || state.campaign.name
    state.campaign.author = campaignAuthorEl.value.trim() || undefined
    state.campaign.difficulty = Number(campaignDifficultyEl.value) || undefined
    currentLevel(state).name = levelNameEl.value || currentLevel(state).name
    saveDraftWithStamp(state.mapId, state.campaign)
    state.dirty = false
    updateDirtyUi(autosave)
  }

  bindCanvasInput({
    state,
    canvas,
    objectType: () => objectTypeEl.value,
    placeTheta: () => Number(placeThetaEl.value) || 0,
    placePairId: () => Number(placePairIdEl.value) || 0,
    enemyCount: () => Math.max(1, Number(selCountEl.value) || 1),
    lastPan,
    beforeEdit,
    afterEdit,
    refreshUi,
    draw,
    syncPropsFromSelection: () => syncPropsFromSelection(propsHost),
    refreshValidation,
    deleteSelection,
    closePolygon: closePoly,
    undo,
    redo,
    copySelection,
    pasteClipboard,
  })

  canvas.addEventListener("mousemove", (e) => {
    const [wx, wy] = cursorWorld(e, canvas, state.camera, state.viewState.gridStep)
    updateStatusBar(wx, wy)
  })

  const onModesClick = (e: Event) => {
    const btn = (e.target as HTMLElement).closest("button[data-mode]") as HTMLButtonElement | null
    if (!btn) {
      return
    }
    setEditorMode(state, modesEl, btn.dataset.mode as EditorState["mode"], draw)
  }

  const onRegionPropsInput = () => {
    if (state.selection.kind !== "region") {
      return
    }
    beforeEdit()
    applyRegionProps(propsHost)
    afterEdit()
  }
  const onCampaignMetaChange = () => {
    state.campaign.name = campaignNameEl.value
    state.campaign.author = campaignAuthorEl.value.trim() || undefined
    state.campaign.difficulty = Number(campaignDifficultyEl.value) || undefined
    markDirty()
  }

  const onLevelNameChange = () => {
    currentLevel(state).name = levelNameEl.value
    refreshUi()
  }

  const onAddLevel = () => {
    beforeEdit()
    state.campaign.levels.push(emptyLevel(t("level.numbered", { n: state.campaign.levels.length + 1 })))
    state.levelIndex = state.campaign.levels.length - 1
    clearSelection(state)
    afterEdit()
    refreshUi()
  }

  const onDupLevel = () => {
    beforeEdit()
    state.campaign.levels.splice(state.levelIndex + 1, 0, structuredClone(currentLevel(state)))
    state.levelIndex++
    clearSelection(state)
    afterEdit()
    refreshUi()
  }

  const onDelLevel = () => {
    if (state.campaign.levels.length <= 1) {
      return
    }
    if (!confirm(t("confirm.deleteLevel"))) {
      return
    }
    beforeEdit()
    state.campaign.levels.splice(state.levelIndex, 1)
    state.levelIndex = Math.max(0, state.levelIndex - 1)
    clearSelection(state)
    afterEdit()
    refreshUi()
  }

  const onSave = () => {
    persist()
    alert(t("alert.draftSaved"))
  }

  const onApplyToGame = () => {
    persist(true)
    const blob = new Blob([JSON.stringify(state.campaign, null, 2)], { type: "application/json" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `${state.mapId || "campaign"}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    alert(t("alert.applyToGame", { id: state.mapId }))
  }

  const onExport = () => {
    persist()
    const blob = new Blob([JSON.stringify(state.campaign, null, 2)], { type: "application/json" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `${state.mapId || "campaign"}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const onImportClick = () => fileEl.click()

  const onFileChange = async () => {
    const file = fileEl.files?.[0]
    fileEl.value = ""
    if (!file) {
      return
    }
    try {
      beforeEdit()
      state.campaign = parseCampaignText(await file.text())
      state.levelIndex = 0
      clearSelection(state)
      history.clear()
      afterEdit()
      refreshUi()
    } catch (err) {
      alert(String(err))
    }
  }

  const onReset = async () => {
    if (!confirm(t("confirm.reset"))) {
      return
    }
    clearCampaignDraft(state.mapId)
    const entry = catalogMaps.find((m) => m.id === state.mapId)
    if (!entry) {
      alert(t("error.mapNotInCatalog"))
      return
    }
    state.campaign = structuredClone(await fetchCampaignFile(entry.file))
    state.levelIndex = 0
    clearSelection(state)
    history.clear()
    state.dirty = false
    updateDirtyUi()
    refreshUi()
  }

  const onMapSelectChange = () => {
    persist(true)
    const next = mapSelectEl.value
    rememberSelectedMapId(next)
    void reload(next)
  }

  pairPresetsEl.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("button[data-deg]") as HTMLButtonElement | null
    if (!btn || state.selection.kind !== "object") {
      return
    }
    selPairIdEl.value = btn.dataset.deg || "0"
    applyObjectProps(propsHost)
    syncPropsFromSelection(propsHost)
  })

  window.addEventListener("resize", resize)
  modesEl.addEventListener("click", onModesClick)
  closePolyBtn.addEventListener("click", closePoly)
  deleteSelBtn.addEventListener("click", deleteSelection)
  floorEl.addEventListener("input", onRegionPropsInput)
  ceilEl.addEventListener("input", onRegionPropsInput)
  dom.regionIdEl.addEventListener("input", onRegionPropsInput)
  dom.regionTextureEl.addEventListener("input", onRegionPropsInput)
  campaignNameEl.addEventListener("change", onCampaignMetaChange)
  campaignAuthorEl.addEventListener("change", onCampaignMetaChange)
  campaignDifficultyEl.addEventListener("change", onCampaignMetaChange)
  levelNameEl.addEventListener("change", onLevelNameChange)
  addLevelBtn.addEventListener("click", onAddLevel)
  dupLevelBtn.addEventListener("click", onDupLevel)
  delLevelBtn.addEventListener("click", onDelLevel)
  saveStorageBtn.addEventListener("click", onSave)
  exportJsonBtn.addEventListener("click", onExport)
  importJsonBtn.addEventListener("click", onImportClick)
  fileEl.addEventListener("change", onFileChange)
  resetDefaultBtn.addEventListener("click", () => void onReset())
  mapSelectEl.addEventListener("change", onMapSelectChange)
  fitLevelBtn.addEventListener("click", () => {
    fitCameraToLevel(canvas, state.camera, currentLevel(state))
    markPreviewDirty(state)
    draw()
  })
  testLevelBtn.addEventListener("click", () => options.onTest?.(getTestCampaign(false)))
  testCampaignBtn.addEventListener("click", () => options.onTest?.(getTestCampaign(true)))
  applyGameBtn.addEventListener("click", onApplyToGame)

  layerRegionsEl.addEventListener("change", () => {
    state.viewState.layers.regions = layerRegionsEl.checked
    markPreviewDirty(state)
    draw()
  })
  layerObjectsEl.addEventListener("change", () => {
    state.viewState.layers.objects = layerObjectsEl.checked
    markPreviewDirty(state)
    draw()
  })
  layerPlayerEl.addEventListener("change", () => {
    state.viewState.layers.player = layerPlayerEl.checked
    markPreviewDirty(state)
    draw()
  })
  objectFilterEl.addEventListener("change", () => {
    state.viewState.objectFilter = objectFilterEl.value as typeof state.viewState.objectFilter
    refreshEntityLists()
    markPreviewDirty(state)
    draw()
  })
  gridStepEl.addEventListener("change", () => {
    state.viewState.gridStep = Math.max(1, Math.min(32, Number(gridStepEl.value) || DEFAULT_GRID_STEP))
    gridStepEl.value = String(state.viewState.gridStep)
    draw()
  })

  minimapCanvas.addEventListener("mousedown", (e) => {
    const pt = minimapWorldFromEvent(e, minimapCanvas, getLevelBounds(currentLevel(state), 0))
    if (pt) {
      panCameraToWorld(canvas, state.camera, pt[0], pt[1])
      draw()
    }
  })

  const propFields = [
    selTypeEl, selXEl, selYEl, selZEl, selPairIdEl, selRotationEl, selCountEl,
    playerXEl, playerYEl, playerZEl,
  ]
  propFields.forEach((field) => {
    field.addEventListener("focus", beforeEdit)
    field.addEventListener("blur", () => {
      editRecorded = false
    })
  })

  selTypeEl.addEventListener("input", () => {
    applyObjectProps(propsHost)
    syncPropsFromSelection(propsHost)
  })
  selXEl.addEventListener("input", () => applyObjectProps(propsHost))
  selYEl.addEventListener("input", () => applyObjectProps(propsHost))
  selZEl.addEventListener("input", () => applyObjectProps(propsHost))
  selPairIdEl.addEventListener("input", () => applyObjectProps(propsHost))
  selRotationEl.addEventListener("input", () => applyObjectProps(propsHost))
  selCountEl.addEventListener("input", () => applyObjectProps(propsHost))
  playerXEl.addEventListener("input", () => applyPlayerProps(propsHost))
  playerYEl.addEventListener("input", () => applyPlayerProps(propsHost))
  playerZEl.addEventListener("input", () => applyPlayerProps(propsHost))

  advanced = wireAdvancedEditor({
    dom,
    state,
    catalogMaps: () => catalogMaps,
    setCatalogMaps: (maps) => {
      catalogMaps = maps
    },
    beforeEdit,
    afterEdit,
    markDirty,
    refreshUi,
    draw2d: draw,
    persist,
    reload,
    fillMapSelect: fillEditorMapSelect,
    onTest: (campaign) => options.onTest?.(campaign),
    syncPropsFromSelection: () => syncPropsFromSelection(propsHost),
  })

  dom.playFromHereBtn.addEventListener("click", () => {
    options.onTest?.(advanced.getPlayFromHereCampaign())
  })

  onLocaleChange(() => refreshUi())

  return {
    reload,
    fillMapSelect: fillEditorMapSelect,
    resize,
    getTestCampaign,
    isDirty: () => state.dirty,
    confirmLeave: () => {
      if (!state.dirty) {
        return true
      }
      return confirm(t("confirm.unsavedLeave"))
    },
  }
}
