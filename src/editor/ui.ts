import { button, el } from "../ui/el"
import { OBJECT_TYPES } from "../map/levelFormat"
import { REGION_TEXTURE_OPTIONS } from "../map/textures"
import { applyI18n, t } from "../i18n"
import { objectLabel } from "./helpers"
import { EDITOR_HOTKEYS } from "./document"

export type EditorDom = {
  root: HTMLElement
  canvas: HTMLCanvasElement
  canvas3d: HTMLCanvasElement
  overlay3d: HTMLCanvasElement
  view: HTMLElement
  view2dPane: HTMLElement
  view3dPane: HTMLElement
  viewTabsEl: HTMLElement
  layoutSplitBtn: HTMLButtonElement
  layout2dBtn: HTMLButtonElement
  layout3dBtn: HTMLButtonElement
  mapSelectEl: HTMLSelectElement
  modesEl: HTMLElement
  objectTypeEl: HTMLSelectElement
  placeThetaEl: HTMLInputElement
  placePairIdEl: HTMLInputElement
  floorEl: HTMLInputElement
  ceilEl: HTMLInputElement
  campaignNameEl: HTMLInputElement
  campaignAuthorEl: HTMLInputElement
  campaignDifficultyEl: HTMLSelectElement
  levelNameEl: HTMLInputElement
  levelListEl: HTMLDivElement
  fileEl: HTMLInputElement
  closePolyBtn: HTMLButtonElement
  deleteSelBtn: HTMLButtonElement
  addLevelBtn: HTMLButtonElement
  dupLevelBtn: HTMLButtonElement
  delLevelBtn: HTMLButtonElement
  saveStorageBtn: HTMLButtonElement
  exportJsonBtn: HTMLButtonElement
  importJsonBtn: HTMLButtonElement
  resetDefaultBtn: HTMLButtonElement
  fitLevelBtn: HTMLButtonElement
  propsPanel: HTMLElement
  propsObjectEl: HTMLElement
  propsPlayerEl: HTMLElement
  propsRegionEl: HTMLElement
  regionIdEl: HTMLInputElement
  regionTextureEl: HTMLSelectElement
  propsVertexEl: HTMLElement
  selTypeEl: HTMLSelectElement
  selXEl: HTMLInputElement
  selYEl: HTMLInputElement
  selZEl: HTMLInputElement
  selPairIdEl: HTMLInputElement
  selRotationEl: HTMLInputElement
  selRotationWrapEl: HTMLElement
  selCountEl: HTMLInputElement
  countWrapEl: HTMLElement
  pairHintEl: HTMLElement
  pairPresetsEl: HTMLElement
  playerXEl: HTMLInputElement
  playerYEl: HTMLInputElement
  playerZEl: HTMLInputElement
  vertexInfoEl: HTMLElement
  validateListEl: HTMLUListElement
  testLevelBtn: HTMLButtonElement
  testCampaignBtn: HTMLButtonElement
  statusBarEl: HTMLElement
  fpsStatusEl: HTMLElement
  regionListEl: HTMLDivElement
  objectListEl: HTMLDivElement
  dirtyIndicatorEl: HTMLElement
  minimapCanvas: HTMLCanvasElement
  layerRegionsEl: HTMLInputElement
  layerObjectsEl: HTMLInputElement
  layerPlayerEl: HTMLInputElement
  layerGridEl: HTMLInputElement
  layerHelpersEl: HTMLInputElement
  ghostModeEl: HTMLInputElement
  sectionZEl: HTMLInputElement
  showLinksEl: HTMLInputElement
  showAxisEl: HTMLInputElement
  objectFilterEl: HTMLSelectElement
  gridStepEl: HTMLInputElement
  applyGameBtn: HTMLButtonElement
  outlinerEl: HTMLDivElement
  outlinerSearchEl: HTMLInputElement
  textureBrowserEl: HTMLDivElement
  bookmarksEl: HTMLDivElement
  addBookmarkBtn: HTMLButtonElement
  primitivesEl: HTMLElement
  extrudeBtn: HTMLButtonElement
  mergeBtn: HTMLButtonElement
  snapVertBtn: HTMLButtonElement
  splitEdgeBtn: HTMLButtonElement
  alignXBtn: HTMLButtonElement
  alignYBtn: HTMLButtonElement
  distributeXBtn: HTMLButtonElement
  snapGridBtn: HTMLButtonElement
  snapFloorBtn: HTMLButtonElement
  levelNotesEl: HTMLTextAreaElement
  levelTagsEl: HTMLInputElement
  exportLevelBtn: HTMLButtonElement
  importLevelBtn: HTMLButtonElement
  levelFileEl: HTMLInputElement
  newMapBtn: HTMLButtonElement
  renameMapBtn: HTMLButtonElement
  dupMapBtn: HTMLButtonElement
  delMapBtn: HTMLButtonElement
  recoveryPanelEl: HTMLDivElement
  recoveryListEl: HTMLDivElement
  cheatSheetEl: HTMLDivElement
  helpBtn: HTMLButtonElement
  ctxMenuEl: HTMLDivElement
  playFromHereBtn: HTMLButtonElement
  diffBtn: HTMLButtonElement
  diffStatusEl: HTMLElement
  levelThumbsEl: HTMLDivElement
}

const modeKeys = {
  select: "mode.select",
  region: "mode.region",
  object: "mode.object",
  player: "mode.player",
  measure: "mode.measure",
} as const

function numInput(id: string, value = "0"): HTMLInputElement {
  return el("input", { id, type: "number", step: "1", value }) as HTMLInputElement
}

export function applyEditorI18n(dom: EditorDom): void {
  applyI18n(dom.root)
  dom.modesEl.querySelectorAll<HTMLButtonElement>("button[data-mode]").forEach((btn) => {
    const mode = btn.dataset.mode as keyof typeof modeKeys
    if (mode in modeKeys) {
      btn.textContent = t(modeKeys[mode])
    }
  })
  OBJECT_TYPES.forEach((type, index) => {
    dom.objectTypeEl.options[index].textContent = objectLabel(type)
    dom.selTypeEl.options[index].textContent = objectLabel(type)
  })
  ;["0", "1", "2"].forEach((value, index) => {
    dom.campaignDifficultyEl.options[index].textContent = t(`difficulty.${value}` as "difficulty.0")
  })
  REGION_TEXTURE_OPTIONS.forEach((option, index) => {
    dom.regionTextureEl.options[index].textContent = t(option.labelKey)
  })
}

export function createEditorScreen(handlers: { onBack: () => void }): EditorDom {
  const modesEl = el("div", { className: "modes", id: "modes" },
    button(t("mode.select"), { dataset: { mode: "select", i18n: "mode.select" }, className: "active" }),
    button(t("mode.region"), { dataset: { mode: "region", i18n: "mode.region" }}),
    button(t("mode.object"), { dataset: { mode: "object", i18n: "mode.object" }}),
    button(t("mode.player"), { dataset: { mode: "player", i18n: "mode.player" }}),
    button(t("mode.measure"), { dataset: { mode: "measure", i18n: "mode.measure" }}),
  )

  const mapSelectEl = el("select", { id: "editorMapSelect" }) as HTMLSelectElement
  const fitLevelBtn = button(t("action.fitLevel"), { id: "fitLevel", dataset: { i18n: "action.fitLevel" } })
  const testLevelBtn = button(t("action.testLevel"), { id: "testLevel", className: "primary", dataset: { i18n: "action.testLevel" } })
  const testCampaignBtn = button(t("action.testCampaign"), { id: "testCampaign", dataset: { i18n: "action.testCampaign" } })
  const playFromHereBtn = button(t("action.playFromHere"), {
    id: "playFromHere",
    dataset: { i18n: "action.playFromHere" },
  })
  const diffBtn = button(t("action.diff"), { id: "diffBtn", dataset: { i18n: "action.diff" } })
  const diffStatusEl = el("span", { className: "diff-status", id: "diffStatus", dataset: { i18n: "status.diffIdle" } }, t("status.diffIdle"))
  const dirtyIndicatorEl = el("span", { className: "dirty-indicator", id: "dirtyIndicator", hidden: true }, "●")

  const layerRegionsEl = el("input", { id: "layerRegions", type: "checkbox", checked: true }) as HTMLInputElement
  const layerObjectsEl = el("input", { id: "layerObjects", type: "checkbox", checked: true }) as HTMLInputElement
  const layerPlayerEl = el("input", { id: "layerPlayer", type: "checkbox", checked: true }) as HTMLInputElement
  const layerGridEl = el("input", { id: "layerGrid", type: "checkbox", checked: true }) as HTMLInputElement
  const layerHelpersEl = el("input", { id: "layerHelpers", type: "checkbox", checked: true }) as HTMLInputElement

  const ghostModeEl = el("input", { id: "ghostMode", type: "checkbox" }) as HTMLInputElement
  const sectionZEl = numInput("sectionZ", "")
  sectionZEl.placeholder = t("label.sectionZPlaceholder")
  const showLinksEl = el("input", { id: "showLinks", type: "checkbox", checked: true }) as HTMLInputElement
  const showAxisEl = el("input", { id: "showAxis", type: "checkbox", checked: true }) as HTMLInputElement

  const objectFilterEl = el("select", { id: "objectFilter" }) as HTMLSelectElement
  objectFilterEl.append(el("option", { value: "" }, t("filter.allTypes")))
  OBJECT_TYPES.forEach((type) => {
    objectFilterEl.append(el("option", { value: type }, objectLabel(type)))
  })

  const gridStepEl = numInput("gridStep", "4")
  gridStepEl.min = "1"
  gridStepEl.max = "32"

  const minimapCanvas = el("canvas", { id: "minimapCanvas", className: "minimap" }) as HTMLCanvasElement

  const objectTypeEl = el("select", { id: "objectType" }) as HTMLSelectElement
  OBJECT_TYPES.forEach((type) => {
    objectTypeEl.append(el("option", { value: type }, objectLabel(type)))
  })

  const placeThetaEl = numInput("placeTheta", "0")
  const placePairIdEl = numInput("placePairId", "0")
  placePairIdEl.step = "15"
  const floorEl = numInput("floor", "4")
  const ceilEl = numInput("ceil", "40")
  floorEl.step = "1"
  ceilEl.step = "1"
  placeThetaEl.step = "15"

  const selTypeEl = el("select", { id: "selType" }) as HTMLSelectElement
  OBJECT_TYPES.forEach((type) => {
    selTypeEl.append(el("option", { value: type }, objectLabel(type)))
  })
  const selXEl = numInput("selX")
  const selYEl = numInput("selY")
  const selZEl = numInput("selZ")
  const selPairIdEl = numInput("selPairId")
  selPairIdEl.step = "15"
  const selRotationEl = numInput("selRotation")
  selRotationEl.step = "15"
  const selRotationWrapEl = el("div", { className: "rotation-wrap", id: "selRotationWrap" },
    el("label", { dataset: { i18n: "label.rotation" } }, t("label.rotation")),
    selRotationEl,
  )
  const selCountEl = numInput("selCount", "1")
  const countWrapEl = el("div", { className: "count-wrap", id: "countWrap" },
    el("label", { dataset: { i18n: "label.count" } }, t("label.count")),
    selCountEl,
  )
  const pairHintEl = el("p", { className: "hint pair-hint", dataset: { i18n: "hint.pairId" } }, t("hint.pairId"))
  const pairPresetsEl = el("div", { className: "pair-presets" })

  const playerXEl = numInput("playerX")
  const playerYEl = numInput("playerY")
  const playerZEl = numInput("playerZ", "10")

  const propsObjectEl = el("div", { className: "props-section", id: "propsObject", hidden: true },
    el("label", { dataset: { i18n: "label.objectType" } }, t("label.objectType")),
    selTypeEl,
    el("label", { dataset: { i18n: "label.position" } }, t("label.position")),
    el("div", { className: "row" }, selXEl, selYEl),
    el("label", { dataset: { i18n: "label.heightZ" } }, t("label.heightZ")),
    selZEl,
    el("label", { dataset: { i18n: "label.pairId" } }, t("label.pairId")),
    selPairIdEl,
    pairHintEl,
    pairPresetsEl,
    selRotationWrapEl,
    countWrapEl,
  )

  const propsPlayerEl = el("div", { className: "props-section", id: "propsPlayer", hidden: true },
    el("label", { dataset: { i18n: "label.player" } }, t("label.player")),
    el("div", { className: "row" }, playerXEl, playerYEl),
    el("label", { dataset: { i18n: "label.heightZ" } }, t("label.heightZ")),
    playerZEl,
  )

  const regionIdEl = el("input", { id: "regionId", type: "text" }) as HTMLInputElement
  const regionTextureEl = el("select", { id: "regionTexture" }) as HTMLSelectElement
  REGION_TEXTURE_OPTIONS.forEach((option) => {
    regionTextureEl.append(el("option", { value: String(option.value) }, t(option.labelKey)))
  })

  const propsRegionEl = el("div", { className: "props-section", id: "propsRegion", hidden: true },
    el("label", { dataset: { i18n: "label.regionId" } }, t("label.regionId")),
    regionIdEl,
    el("label", { dataset: { i18n: "label.regionTexture" } }, t("label.regionTexture")),
    regionTextureEl,
    el("label", { dataset: { i18n: "label.floorCeil" } }, t("label.floorCeil")),
    el("div", { className: "row" }, floorEl, ceilEl),
  )

  const vertexInfoEl = el("p", { className: "vertex-info" }, "")
  const propsVertexEl = el("div", { className: "props-section", id: "propsVertex", hidden: true },
    el("label", { dataset: { i18n: "label.vertex" } }, t("label.vertex")),
    vertexInfoEl,
  )

  const propsPanel = el("div", { className: "props-panel", id: "propsPanel" },
    el("h2", { className: "props-title", dataset: { i18n: "label.properties" } }, t("label.properties")),
    propsObjectEl,
    propsPlayerEl,
    propsRegionEl,
    propsVertexEl,
  )

  const validateListEl = el("ul", { className: "validate-list", id: "validateList" }) as HTMLUListElement

  const closePolyBtn = button(t("action.closePoly"), {
    id: "closePoly",
    className: "primary",
    dataset: { i18n: "action.closePoly" },
  })

  const deleteSelBtn = button(t("action.deleteSelected"), {
    id: "deleteSel",
    className: "danger",
    dataset: { i18n: "action.deleteSelected" },
  })

  const extrudeBtn = button(t("action.extrude"), { id: "extrudeBtn", dataset: { i18n: "action.extrude" } })
  const mergeBtn = button(t("action.merge"), { id: "mergeBtn", dataset: { i18n: "action.merge" } })
  const snapVertBtn = button(t("action.snapVertex"), { id: "snapVertBtn", dataset: { i18n: "action.snapVertex" } })
  const splitEdgeBtn = button(t("action.splitEdge"), { id: "splitEdgeBtn", dataset: { i18n: "action.splitEdge" } })

  const alignXBtn = button(t("action.alignX"), { id: "alignXBtn", dataset: { i18n: "action.alignX" } })
  const alignYBtn = button(t("action.alignY"), { id: "alignYBtn", dataset: { i18n: "action.alignY" } })
  const distributeXBtn = button(t("action.distributeX"), { id: "distributeXBtn", dataset: { i18n: "action.distributeX" } })
  const snapGridBtn = button(t("action.snapGrid"), { id: "snapGridBtn", dataset: { i18n: "action.snapGrid" } })
  const snapFloorBtn = button(t("action.snapFloor"), { id: "snapFloorBtn", dataset: { i18n: "action.snapFloor" } })

  const primitivesEl = el("div", { className: "primitives", id: "primitives" },
    button(t("action.primitiveBox"), { id: "primBox", className: "primitive-btn", dataset: { primitive: "box", i18n: "action.primitiveBox" } }),
    button(t("action.primitiveCorridor"), { id: "primCorridor", className: "primitive-btn", dataset: { primitive: "corridor", i18n: "action.primitiveCorridor" } }),
    button(t("action.primitiveRamp"), { id: "primRamp", className: "primitive-btn", dataset: { primitive: "ramp", i18n: "action.primitiveRamp" } }),
  )

  const helpBtn = button(t("action.help"), { id: "helpBtn", dataset: { i18n: "action.help" } })

  const campaignNameEl = el("input", { id: "campaignName", type: "text" }) as HTMLInputElement
  const campaignAuthorEl = el("input", { id: "campaignAuthor", type: "text" }) as HTMLInputElement
  const campaignDifficultyEl = el("select", { id: "campaignDifficulty" }) as HTMLSelectElement
  ;["0", "1", "2"].forEach((value) => {
    campaignDifficultyEl.append(el("option", { value }, t(`difficulty.${value}` as "difficulty.0")))
  })
  const levelNameEl = el("input", { id: "levelName", type: "text" }) as HTMLInputElement
  const levelListEl = el("div", { className: "level-list", id: "levelList" }) as HTMLDivElement
  const regionListEl = el("div", { className: "entity-list", id: "regionList" }) as HTMLDivElement
  const objectListEl = el("div", { className: "entity-list", id: "objectList" }) as HTMLDivElement
  const fileEl = el("input", {
    id: "file",
    type: "file",
    accept: "application/json,.json",
    hidden: true,
  }) as HTMLInputElement

  const levelFileEl = el("input", {
    id: "levelFile",
    type: "file",
    accept: "application/json,.json",
    hidden: true,
  }) as HTMLInputElement

  const addLevelBtn = button(t("action.addLevel"), { id: "addLevel", dataset: { i18n: "action.addLevel" } })
  const dupLevelBtn = button(t("action.duplicateLevel"), { id: "dupLevel", dataset: { i18n: "action.duplicateLevel" } })
  const delLevelBtn = button(t("action.deleteLevel"), { id: "delLevel", className: "danger", dataset: { i18n: "action.deleteLevel" } })
  const saveStorageBtn = button(t("action.save"), { id: "saveStorage", className: "primary", dataset: { i18n: "action.save" } })
  const exportJsonBtn = button(t("action.exportJson"), { id: "exportJson", dataset: { i18n: "action.exportJson" } })
  const importJsonBtn = button(t("action.importJson"), { id: "importJson", dataset: { i18n: "action.importJson" } })
  const resetDefaultBtn = button(t("action.resetDefault"), { id: "resetDefault", className: "danger", dataset: { i18n: "action.resetDefault" } })

  const exportLevelBtn = button(t("action.exportLevel"), { id: "exportLevel", dataset: { i18n: "action.exportLevel" } })
  const importLevelBtn = button(t("action.importLevel"), { id: "importLevel", dataset: { i18n: "action.importLevel" } })

  const newMapBtn = button(t("action.newMap"), { id: "newMapBtn", dataset: { i18n: "action.newMap" } })
  const renameMapBtn = button(t("action.renameMap"), { id: "renameMapBtn", dataset: { i18n: "action.renameMap" } })
  const dupMapBtn = button(t("action.duplicateMap"), { id: "dupMapBtn", dataset: { i18n: "action.duplicateMap" } })
  const delMapBtn = button(t("action.deleteMap"), { id: "delMapBtn", className: "danger", dataset: { i18n: "action.deleteMap" } })

  const applyGameBtn = button(t("action.applyToGame"), {
    id: "applyGame",
    className: "primary",
    dataset: { i18n: "action.applyToGame" },
  })

  const outlinerSearchEl = el("input", {
    id: "outlinerSearch",
    type: "search",
    placeholder: t("label.outlinerSearchPlaceholder"),
    dataset: { i18n: "label.outlinerSearchPlaceholder" },
  }) as HTMLInputElement
  const outlinerEl = el("div", { className: "outliner", id: "outliner" }) as HTMLDivElement

  const textureBrowserEl = el("div", { className: "texture-browser", id: "textureBrowser" }) as HTMLDivElement

  const addBookmarkBtn = button(t("action.addBookmark"), { id: "addBookmark", dataset: { i18n: "action.addBookmark" } })
  const bookmarksEl = el("div", { className: "bookmarks", id: "bookmarks" }) as HTMLDivElement

  const levelNotesEl = el("textarea", { id: "levelNotes", rows: 3, placeholder: t("label.notesPlaceholder") }) as HTMLTextAreaElement
  const levelTagsEl = el("input", { id: "levelTags", type: "text", placeholder: t("label.tagsPlaceholder") }) as HTMLInputElement

  const recoveryListEl = el("div", { className: "recovery-list", id: "recoveryList" }) as HTMLDivElement
  const recoveryPanelEl = el("div", { className: "recovery-panel", id: "recoveryPanel" },
    el("h3", { className: "panel-title", dataset: { i18n: "label.recovery" } }, t("label.recovery")),
    recoveryListEl,
  )

  const levelThumbsEl = el("div", { className: "level-thumbs", id: "levelThumbs" }) as HTMLDivElement

  const canvas = el("canvas", { id: "editorCanvas" }) as HTMLCanvasElement
  const canvas3d = el("canvas", { id: "editorCanvas3d" }) as HTMLCanvasElement
  const overlay3d = el("canvas", { id: "editorOverlay3d", className: "editor-overlay-3d" }) as HTMLCanvasElement

  const layout2dBtn = button(t("editor.view2d"), {
    id: "layout2d",
    className: "view-tab active",
    dataset: { layout: "2d", i18n: "editor.view2d" },
  })
  const layoutSplitBtn = button(t("editor.viewSplit"), {
    id: "layoutSplit",
    className: "view-tab",
    dataset: { layout: "split", i18n: "editor.viewSplit" },
  })
  const layout3dBtn = button(t("editor.view3d"), {
    id: "layout3d",
    className: "view-tab",
    dataset: { layout: "3d", i18n: "editor.view3d" },
  })
  const viewTabsEl = el("div", {
    className: "view-switcher",
    id: "viewTabs",
    role: "group",
    title: t("editor.viewSwitcherHint"),
  }, layout2dBtn, layoutSplitBtn, layout3dBtn)

  const statusBarEl = el("div", { className: "editor-status", id: "editorStatus" }, "")
  const fpsStatusEl = el("span", { className: "fps-status", id: "editorFps" }, t("status.previewOff"))

  const view2dPane = el("div", { className: "view-pane view2d-pane", id: "view2dPane" },
    el("div", { className: "pane-badge", dataset: { i18n: "editor.view2d" } }, t("editor.view2d")),
    canvas,
    minimapCanvas,
  )
  const view3dPane = el("div", { className: "view-pane view3d-pane", id: "view3dPane" },
    el("div", { className: "pane-badge", dataset: { i18n: "editor.view3d" } }, t("editor.view3d")),
    el("div", { className: "view3d-stack" }, canvas3d, overlay3d),
  )

  const view = el(
    "div",
    { id: "editorView", className: "editor-view-2d" },
    el("div", { className: "view-panes" }, view2dPane, view3dPane),
    el("div", { className: "editor-view-footer" }, statusBarEl, fpsStatusEl),
  )

  const cheatSheetRows = EDITOR_HOTKEYS.map((entry) =>
    el("div", { className: "cheat-row" },
      el("kbd", {}, entry.keys),
      el("span", { dataset: { i18n: entry.i18nKey } }, t(entry.i18nKey as Parameters<typeof t>[0])),
    ),
  )
  const cheatSheetEl = el("div", { className: "cheat-sheet", id: "cheatSheet", hidden: true },
    el("div", { className: "cheat-sheet-inner" },
      el("h2", { dataset: { i18n: "editor.cheatSheetTitle" } }, t("editor.cheatSheetTitle")),
      el("div", { className: "cheat-sheet-body" }, ...cheatSheetRows),
      button("X", { className: "cheat-sheet-close", type: "button", dataset: { i18n: "action.close" } }),
    ),
  )

  const ctxMenuEl = el("div", { className: "ctx-menu", id: "ctxMenu", hidden: true },
    button(t("ctx.focus"), { className: "ctx-item", dataset: { action: "focus", i18n: "ctx.focus" } }),
    button(t("ctx.duplicate"), { className: "ctx-item", dataset: { action: "duplicate", i18n: "ctx.duplicate" } }),
    button(t("ctx.goToPair"), { className: "ctx-item", dataset: { action: "goToPair", i18n: "ctx.goToPair" } }),
    button(t("ctx.playFromHere"), { className: "ctx-item", dataset: { action: "playFromHere", i18n: "ctx.playFromHere" } }),
    button(t("ctx.delete"), { className: "ctx-item danger", dataset: { action: "delete", i18n: "ctx.delete" } }),
  )

  const root = el(
    "div",
    { id: "screen-editor", className: "screen", dataset: { layout: "2d" } },
    el(
      "header",
      { className: "editor-header" },
      el("div", { className: "header-left" },
        button(t("menu.back"), { id: "btnBack", dataset: { i18n: "menu.back" } }, handlers.onBack),
        el("h1", { dataset: { i18n: "editor.title" } }, t("editor.title")),
        dirtyIndicatorEl,
      ),
      el("div", { className: "header-center" },
        el("span", { className: "view-switcher-label", dataset: { i18n: "editor.viewLabel" } }, t("editor.viewLabel")),
        viewTabsEl,
      ),
      el("div", { className: "header-actions" },
        el("label", { className: "map-label", htmlFor: "editorMapSelect", dataset: { i18n: "menu.map" } }, t("menu.map")),
        mapSelectEl,
        fitLevelBtn,
        playFromHereBtn,
        testLevelBtn,
        testCampaignBtn,
        helpBtn,
      ),
    ),
    el(
      "div",
      { className: "editor-toolbar" },
      el("div", { className: "toolbar-modes" },
        el("span", { className: "toolbar-label", dataset: { i18n: "label.mode" } }, t("label.mode")),
        modesEl,
      ),
      el("div", { className: "toolbar-actions" },
        closePolyBtn,
        deleteSelBtn,
        el("span", { className: "toolbar-sep" }),
        el("span", { className: "toolbar-label", dataset: { i18n: "label.gridStep" } }, t("label.gridStep")),
        gridStepEl,
      ),
    ),
    el(
      "aside",
      { className: "editor-aside-left" },
      propsPanel,
      el("details", { className: "panel-block", open: true },
        el("summary", { dataset: { i18n: "label.placeObject" } }, t("label.placeObject")),
        el("div", { className: "panel-body" },
          el("label", { dataset: { i18n: "label.objectType" } }, t("label.objectType")),
          objectTypeEl,
          el("label", { dataset: { i18n: "label.objectAngle" } }, t("label.objectAngle")),
          placeThetaEl,
          el("label", { dataset: { i18n: "label.pairId" } }, t("label.pairId")),
          placePairIdEl,
          el("label", { dataset: { i18n: "label.filterType" } }, t("label.filterType")),
          objectFilterEl,
        ),
      ),
      el("details", { className: "panel-block", open: true },
        el("summary", { dataset: { i18n: "label.layers" } }, t("label.layers")),
        el("div", { className: "panel-body" },
          el("label", { className: "layer-toggle" }, layerRegionsEl, el("span", { dataset: { i18n: "layer.regions" } }, t("layer.regions"))),
          el("label", { className: "layer-toggle" }, layerObjectsEl, el("span", { dataset: { i18n: "layer.objects" } }, t("layer.objects"))),
          el("label", { className: "layer-toggle" }, layerPlayerEl, el("span", { dataset: { i18n: "layer.player" } }, t("layer.player"))),
          el("label", { className: "layer-toggle" }, layerGridEl, el("span", { dataset: { i18n: "layer.grid" } }, t("layer.grid"))),
          el("label", { className: "layer-toggle" }, layerHelpersEl, el("span", { dataset: { i18n: "layer.helpers" } }, t("layer.helpers"))),
        ),
      ),
      el("details", { className: "panel-block panel-3d-only", open: false },
        el("summary", { dataset: { i18n: "label.view3dOptions" } }, t("label.view3dOptions")),
        el("div", { className: "panel-body" },
          el("label", { className: "layer-toggle" }, ghostModeEl, el("span", { dataset: { i18n: "label.ghostMode" } }, t("label.ghostMode"))),
          el("label", { dataset: { i18n: "label.sectionZ" } }, t("label.sectionZ")),
          sectionZEl,
          el("label", { className: "layer-toggle" }, showLinksEl, el("span", { dataset: { i18n: "label.showLinks" } }, t("label.showLinks"))),
          el("label", { className: "layer-toggle" }, showAxisEl, el("span", { dataset: { i18n: "label.showAxis" } }, t("label.showAxis"))),
        ),
      ),
      el("details", { className: "panel-block", open: false },
        el("summary", { dataset: { i18n: "label.primitives" } }, t("label.primitives")),
        el("div", { className: "panel-body" }, primitivesEl),
      ),
      el("details", { className: "panel-block", open: false },
        el("summary", { dataset: { i18n: "label.geometry" } }, t("label.geometry")),
        el("div", { className: "panel-body" },
          el("div", { className: "geom-ops row-2" }, extrudeBtn, mergeBtn),
          el("div", { className: "geom-ops row-2" }, snapVertBtn, splitEdgeBtn),
          el("label", { dataset: { i18n: "label.alignSnap" } }, t("label.alignSnap")),
          el("div", { className: "geom-ops row-2" }, alignXBtn, alignYBtn),
          el("div", { className: "geom-ops row-2" }, distributeXBtn, snapGridBtn),
          snapFloorBtn,
        ),
      ),
      el("details", { className: "panel-block", open: true },
        el("summary", { dataset: { i18n: "label.validation" } }, t("label.validation")),
        el("div", { className: "panel-body" }, validateListEl),
      ),
      el("details", { className: "panel-block", open: false },
        el("summary", { dataset: { i18n: "label.hints" } }, t("label.hints")),
        el("div", { className: "panel-body" },
          el("p", { className: "hint" },
            el("span", { dataset: { i18n: "hint.place" } }, t("hint.place")),
            el("br"),
            el("span", { dataset: { i18n: "hint.drag" } }, t("hint.drag")),
            el("br"),
            el("span", { dataset: { i18n: "hint.copyPaste" } }, t("hint.copyPaste")),
            el("br"),
            el("span", { dataset: { i18n: "hint.delete" } }, t("hint.delete")),
            el("br"),
            el("span", { dataset: { i18n: "hint.zoom" } }, t("hint.zoom")),
            el("br"),
            el("span", { dataset: { i18n: "hint.cancelRegion" } }, t("hint.cancelRegion")),
            el("br"),
            el("span", { dataset: { i18n: "hint.measure" } }, t("hint.measure")),
            el("br"),
            el("span", { dataset: { i18n: "hint.viewSwitch" } }, t("hint.viewSwitch")),
          ),
        ),
      ),
    ),
    view,
    el(
      "div",
      { className: "side editor-aside-right" },
      el("details", { className: "panel-block", open: true },
        el("summary", { dataset: { i18n: "label.outliner" } }, t("label.outliner")),
        el("div", { className: "panel-body" }, outlinerSearchEl, outlinerEl),
      ),
      el("details", { className: "panel-block", open: false },
        el("summary", { dataset: { i18n: "label.textures" } }, t("label.textures")),
        el("div", { className: "panel-body" }, textureBrowserEl),
      ),
      el("details", { className: "panel-block panel-3d-only", open: false },
        el("summary", { dataset: { i18n: "label.bookmarks" } }, t("label.bookmarks")),
        el("div", { className: "panel-body" }, bookmarksEl, addBookmarkBtn),
      ),
      el("details", { className: "panel-block", open: true },
        el("summary", { dataset: { i18n: "label.campaign" } }, t("label.campaign")),
        el("div", { className: "panel-body" },
          campaignNameEl,
          el("label", { dataset: { i18n: "label.author" } }, t("label.author")),
          campaignAuthorEl,
          el("label", { dataset: { i18n: "label.difficulty" } }, t("label.difficulty")),
          campaignDifficultyEl,
          el("label", { dataset: { i18n: "label.mapManager" } }, t("label.mapManager")),
          el("div", { className: "map-manager row-2" }, newMapBtn, renameMapBtn),
          el("div", { className: "map-manager row-2" }, dupMapBtn, delMapBtn),
          levelListEl,
          el("label", { dataset: { i18n: "label.levelThumbs" } }, t("label.levelThumbs")),
          levelThumbsEl,
          addLevelBtn,
          dupLevelBtn,
          delLevelBtn,
          el("label", { dataset: { i18n: "label.levelName" } }, t("label.levelName")),
          levelNameEl,
          el("label", { dataset: { i18n: "label.notes" } }, t("label.notes")),
          levelNotesEl,
          el("label", { dataset: { i18n: "label.tags" } }, t("label.tags")),
          levelTagsEl,
        ),
      ),
      el("details", { className: "panel-block", open: false },
        el("summary", { dataset: { i18n: "label.regions" } }, t("label.regions")),
        el("div", { className: "panel-body" }, regionListEl),
      ),
      el("details", { className: "panel-block", open: false },
        el("summary", { dataset: { i18n: "label.objects" } }, t("label.objects")),
        el("div", { className: "panel-body" }, objectListEl),
      ),
      el("details", { className: "panel-block", open: false },
        el("summary", { dataset: { i18n: "label.files" } }, t("label.files")),
        el("div", { className: "panel-body" },
          exportLevelBtn,
          importLevelBtn,
          levelFileEl,
          applyGameBtn,
          saveStorageBtn,
          exportJsonBtn,
          importJsonBtn,
          fileEl,
          resetDefaultBtn,
          el("div", { className: "diff-row" }, diffBtn, diffStatusEl),
          recoveryPanelEl,
        ),
      ),
    ),
    cheatSheetEl,
    ctxMenuEl,
  )

  const dom: EditorDom = {
    root,
    canvas,
    canvas3d,
    overlay3d,
    view,
    view2dPane,
    view3dPane,
    viewTabsEl,
    layoutSplitBtn,
    layout2dBtn,
    layout3dBtn,
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
    propsPanel,
    propsObjectEl,
    propsPlayerEl,
    propsRegionEl,
    regionIdEl,
    regionTextureEl,
    propsVertexEl,
    selTypeEl,
    selXEl,
    selYEl,
    selZEl,
    selPairIdEl,
    selRotationEl,
    selRotationWrapEl,
    selCountEl,
    countWrapEl,
    pairHintEl,
    pairPresetsEl,
    playerXEl,
    playerYEl,
    playerZEl,
    vertexInfoEl,
    validateListEl,
    testLevelBtn,
    testCampaignBtn,
    statusBarEl,
    fpsStatusEl,
    regionListEl,
    objectListEl,
    dirtyIndicatorEl,
    minimapCanvas,
    layerRegionsEl,
    layerObjectsEl,
    layerPlayerEl,
    layerGridEl,
    layerHelpersEl,
    ghostModeEl,
    sectionZEl,
    showLinksEl,
    showAxisEl,
    objectFilterEl,
    gridStepEl,
    applyGameBtn,
    outlinerEl,
    outlinerSearchEl,
    textureBrowserEl,
    bookmarksEl,
    addBookmarkBtn,
    primitivesEl,
    extrudeBtn,
    mergeBtn,
    snapVertBtn,
    splitEdgeBtn,
    alignXBtn,
    alignYBtn,
    distributeXBtn,
    snapGridBtn,
    snapFloorBtn,
    levelNotesEl,
    levelTagsEl,
    exportLevelBtn,
    importLevelBtn,
    levelFileEl,
    newMapBtn,
    renameMapBtn,
    dupMapBtn,
    delMapBtn,
    recoveryPanelEl,
    recoveryListEl,
    cheatSheetEl,
    helpBtn,
    ctxMenuEl,
    playFromHereBtn,
    diffBtn,
    diffStatusEl,
    levelThumbsEl,
  }

  applyEditorI18n(dom)
  return dom
}
