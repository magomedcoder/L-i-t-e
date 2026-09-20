import "./styles.css"
import { canvas, backToEditorBtn, gameScreen } from "./dom"
import { applyEditorI18n, createEditorScreen } from "./editor/ui"
import { mountEditor } from "./editor/mount"
import { applyMenuI18n, createMenuScreen } from "./ui/menu"
import { fillMapSelect } from "./ui/maps"
import { ctx } from "./state"
import { gameStep, mainRun, registerGameRuntime, reset, setResolution } from "./game/loop"
import { fadeTo } from "./entities"
import { setupMap } from "./map/map"
import { getPreferredMapId, loadCampaignById, loadCatalog, rememberSelectedMapId, setActiveCampaign } from "./map/catalog"
import { type Campaign, parseCampaignText } from "./map/levelFormat"
import { context as audioContext } from "./audio/audio"
import { applyI18n, initLocale, onLocaleChange, t } from "./i18n"

initLocale()

registerGameRuntime()

type Screen = "menu" | "game" | "editor"

let currentScreen: Screen = "menu"
let gameInited = false
let editorBooted = false

function updateTitle(): void {
  document.title = currentScreen === "editor" ? t("editor.title") : t("app.title")
}

updateTitle()

const editor = createEditorScreen({ onBack: () => show("menu") })
const editorApi = mountEditor(editor, {
  onTest: (campaign) => void startEditorTest(campaign),
})

const menu = createMenuScreen({
  onPlay: () => void startGameSession(),
  onEditor: () => void openEditor(),
  onPickFile: () => menu.fileInput.click(),
})

document.body.replaceChildren(menu.root, gameScreen, editor.root)
applyI18n()
onLocaleChange(() => {
  updateTitle()
  applyMenuI18n(menu)
  applyEditorI18n(editor)
  applyI18n()
})

const screens = {
  menu: menu.root,
  game: gameScreen,
  editor: editor.root,
}

function show(screen: Screen): void {
  currentScreen = screen
  ;(Object.keys(screens) as Screen[]).forEach((name) => {
    screens[name].classList.toggle("active", name === screen)
  })
  updateTitle()
}

function selectedMapId(): string {
  return menu.mapSelect.value || getPreferredMapId()
}

async function startEditorTest(campaign: Campaign): Promise<void> {
  await startGameSession(campaign)
  backToEditorBtn.hidden = false
}

backToEditorBtn.addEventListener("click", () => {
  document.exitPointerLock()
  ctx.endScreen = false
  backToEditorBtn.hidden = true
  show("editor")
  editorApi.resize()
})

async function startGameSession(campaignOverride?: Campaign): Promise<void> {
  try {
    menu.statusEl.textContent = t("status.loadingMap")
    if (campaignOverride) {
      setActiveCampaign(campaignOverride)
    } else {
      const id = selectedMapId()
      await loadCampaignById(id)
    }
  } catch (err) {
    menu.statusEl.textContent = String(err)
    alert(String(err))
    show("menu")
    return
  }

  show("game")
  void audioContext.resume()

  if (!gameInited) {
    const gl = canvas.getContext("webgl2", {
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      desynchronized: false,
    })
    if (!gl) {
      alert(t("error.webgl"))
      show("menu")
      return
    }
    ctx.gl = gl
    setResolution(0)
    ctx.globalScreenColor = [0, 0, 0, 0]
    ctx.endScreen = false
    gameInited = true
    mainRun()
    menu.statusEl.textContent = ""
    return
  }

  ctx.endScreen = false
  reset()
  setupMap()
  fadeTo([0, 0, 0, 0])
  gameStep(1)
  menu.statusEl.textContent = ""
}

menu.fileInput.addEventListener("change", async () => {
  const file = menu.fileInput.files?.[0]
  menu.fileInput.value = ""
  if (!file) {
    return
  }

  try {
    const campaign = parseCampaignText(await file.text())
    setActiveCampaign(campaign)
    menu.statusEl.textContent = t("status.fileLoaded", {
      name: file.name
    })
    await startGameSession(campaign)
  } catch (err) {
    alert(String(err))
  }
})

menu.mapSelect.addEventListener("change", () => {
  rememberSelectedMapId(menu.mapSelect.value)
  menu.statusEl.textContent = ""
})

async function openEditor(): Promise<void> {
  show("editor")
  editorApi.resize()

  if (editorBooted) {
    return
  }

  editorBooted = true
  try {
    const maps = await loadCatalog()
    const mapId = getPreferredMapId()
    rememberSelectedMapId(mapId)
    editorApi.fillMapSelect(maps, mapId)
    await editorApi.reload(mapId)
  } catch (err) {
    alert(String(err))
    show("menu")
  }
}

async function boot(): Promise<void> {
  try {
    const maps = await loadCatalog()
    const preferred = getPreferredMapId()
    fillMapSelect(menu.mapSelect, maps, preferred)
    rememberSelectedMapId(preferred)
    menu.statusEl.textContent = ""
  } catch (err) {
    menu.statusEl.textContent = String(err)
  }
  show("menu")
}

void boot()
