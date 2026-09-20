import { button, el } from "../ui/el"
import { OBJECT_TYPES } from "../map/levelFormat"
import { REGION_TEXTURE_OPTIONS } from "../map/textures"
import { applyI18n, t } from "../i18n"
import { objectLabel } from "./helpers"

export type EditorDom = {
  root: HTMLElement
  canvas: HTMLCanvasElement
  view: HTMLElement
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
  regionListEl: HTMLDivElement
  objectListEl: HTMLDivElement
  dirtyIndicatorEl: HTMLElement
  minimapCanvas: HTMLCanvasElement
  layerRegionsEl: HTMLInputElement
  layerObjectsEl: HTMLInputElement
  layerPlayerEl: HTMLInputElement
  objectFilterEl: HTMLSelectElement
  gridStepEl: HTMLInputElement
  applyGameBtn: HTMLButtonElement
}

const modeKeys = {
  select: "mode.select",
  region: "mode.region",
  object: "mode.object",
  player: "mode.player",
} as const

function numInput(id: string, value = "0"): HTMLInputElement {
  return el("input", { id, type: "number", step: "1", value }) as HTMLInputElement
}

export function applyEditorI18n(dom: EditorDom): void {
  applyI18n(dom.root)
  dom.modesEl.querySelectorAll<HTMLButtonElement>("button[data-mode]").forEach((btn) => {
    const mode = btn.dataset.mode as keyof typeof modeKeys
    btn.textContent = t(modeKeys[mode])
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
  )

  const mapSelectEl = el("select", { id: "editorMapSelect" }) as HTMLSelectElement
  const fitLevelBtn = button(t("action.fitLevel"), { id: "fitLevel", dataset: { i18n: "action.fitLevel" } })
  const testLevelBtn = button(t("action.testLevel"), { id: "testLevel", className: "primary", dataset: { i18n: "action.testLevel" } })
  const testCampaignBtn = button(t("action.testCampaign"), { id: "testCampaign", dataset: { i18n: "action.testCampaign" } })
  const statusBarEl = el("div", { className: "editor-status", id: "editorStatus" }, "")
  const dirtyIndicatorEl = el("span", { className: "dirty-indicator", id: "dirtyIndicator", hidden: true }, "●")

  const layerRegionsEl = el("input", { id: "layerRegions", type: "checkbox", checked: true }) as HTMLInputElement
  const layerObjectsEl = el("input", { id: "layerObjects", type: "checkbox", checked: true }) as HTMLInputElement
  const layerPlayerEl = el("input", { id: "layerPlayer", type: "checkbox", checked: true }) as HTMLInputElement

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

  const addLevelBtn = button(t("action.addLevel"), { id: "addLevel", dataset: { i18n: "action.addLevel" } })
  const dupLevelBtn = button(t("action.duplicateLevel"), { id: "dupLevel", dataset: { i18n: "action.duplicateLevel" } })
  const delLevelBtn = button(t("action.deleteLevel"), { id: "delLevel", className: "danger", dataset: { i18n: "action.deleteLevel" } })
  const saveStorageBtn = button(t("action.save"), { id: "saveStorage", className: "primary", dataset: { i18n: "action.save" } })
  const exportJsonBtn = button(t("action.exportJson"), { id: "exportJson", dataset: { i18n: "action.exportJson" } })
  const importJsonBtn = button(t("action.importJson"), { id: "importJson", dataset: { i18n: "action.importJson" } })
  const resetDefaultBtn = button(t("action.resetDefault"), { id: "resetDefault", className: "danger", dataset: { i18n: "action.resetDefault" } })

  const applyGameBtn = button(t("action.applyToGame"), {
    id: "applyGame",
    className: "primary",
    dataset: { i18n: "action.applyToGame" },
  })

  const canvas = el("canvas", { id: "editorCanvas" }) as HTMLCanvasElement
  const view = el("div", { id: "editorView" }, canvas, minimapCanvas, statusBarEl)

  const root = el(
    "div",
    { id: "screen-editor", className: "screen" },
    el(
      "header",
      {},
      button(t("menu.back"), { id: "btnBack", dataset: { i18n: "menu.back" } }, handlers.onBack),
      el("h1", { dataset: { i18n: "editor.title" } }, t("editor.title")),
      el("div", { className: "header-actions" },
        dirtyIndicatorEl,
        fitLevelBtn,
        testLevelBtn,
        testCampaignBtn,
        el("label", { className: "map-label", htmlFor: "editorMapSelect", dataset: { i18n: "menu.map" } }, t("menu.map")),
        mapSelectEl,
      ),
    ),
    el(
      "aside",
      {},
      el("label", { dataset: { i18n: "label.mode" } }, t("label.mode")),
      modesEl,
      propsPanel,
      el("label", { dataset: { i18n: "label.layers" } }, t("label.layers")),
      el("label", { className: "layer-toggle" },
        layerRegionsEl,
        el("span", { dataset: { i18n: "layer.regions" } }, t("layer.regions")),
      ),
      el("label", { className: "layer-toggle" },
        layerObjectsEl,
        el("span", { dataset: { i18n: "layer.objects" } }, t("layer.objects")),
      ),
      el("label", { className: "layer-toggle" },
        layerPlayerEl,
        el("span", { dataset: { i18n: "layer.player" } }, t("layer.player")),
      ),
      el("label", { dataset: { i18n: "label.gridStep" } }, t("label.gridStep")),
      gridStepEl,
      el("label", { dataset: { i18n: "label.filterType" } }, t("label.filterType")),
      objectFilterEl,
      el("label", { dataset: { i18n: "label.objectType" } }, t("label.objectType")),
      objectTypeEl,
      el("label", { dataset: { i18n: "label.objectAngle" } }, t("label.objectAngle")),
      placeThetaEl,
      el("label", { dataset: { i18n: "label.pairId" } }, t("label.pairId")),
      placePairIdEl,
      closePolyBtn,
      deleteSelBtn,
      el("label", { dataset: { i18n: "label.validation" } }, t("label.validation")),
      validateListEl,
      el(
        "p",
        { className: "hint" },
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
      ),
    ),
    view,
    el(
      "div",
      { className: "side" },
      el("label", { dataset: { i18n: "label.campaign" } }, t("label.campaign")),
      campaignNameEl,
      el("label", { dataset: { i18n: "label.author" } }, t("label.author")),
      campaignAuthorEl,
      el("label", { dataset: { i18n: "label.difficulty" } }, t("label.difficulty")),
      campaignDifficultyEl,
      levelListEl,
      addLevelBtn,
      dupLevelBtn,
      delLevelBtn,
      el("label", { dataset: { i18n: "label.levelName" } }, t("label.levelName")),
      levelNameEl,
      el("label", { dataset: { i18n: "label.regions" } }, t("label.regions")),
      regionListEl,
      el("label", { dataset: { i18n: "label.objects" } }, t("label.objects")),
      objectListEl,
      applyGameBtn,
      saveStorageBtn,
      exportJsonBtn,
      importJsonBtn,
      fileEl,
      resetDefaultBtn,
    ),
  )

  const dom: EditorDom = {
    root,
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
  }

  applyEditorI18n(dom)
  return dom
}
