import "./styles.css"
import { canvas, backToEditorBtn, gameScreen } from "./dom"
import { prefersTouchControls, setMobileControlsVisible } from "./game/mobileControls"
import { applyEditorI18n, createEditorScreen } from "./editor/ui"
import { mountEditor } from "./editor/mount"
import { applyMenuI18n, applyMpStatus, createMenuScreen } from "./ui/menu"
import { fillMapSelect } from "./ui/maps"
import { ctx } from "./state"
import { gameStep, mainRun, registerGameRuntime, reset, setResolution } from "./game/loop"
import { fadeTo } from "./entities"
import { newVector } from "./math/vector"
import { setupMap } from "./map/map"
import { getPreferredMapId, loadCampaignById, loadCatalog, rememberSelectedMapId, setActiveCampaign } from "./map/catalog"
import { type Campaign } from "./map/levelFormat"
import { context as audioContext } from "./audio/audio"
import { applyI18n, initLocale, onLocaleChange, t } from "./i18n"
import { mpSession } from "./net/session"
import { clearRemotePlayers } from "./net/remotePlayer"

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

let editorApi: ReturnType<typeof mountEditor>

const editor = createEditorScreen({
  onBack: () => {
    if (editorApi && !editorApi.confirmLeave()) {
      return
    }
    show("menu")
  },
})
editorApi = mountEditor(editor, {
  onTest: (campaign) => void startEditorTest(campaign),
})

const menu = createMenuScreen({
  onPlay: () => void startGameSession(),
  onEditor: () => void openEditor(),
  onCreateRoom: () => {
    void mpSession.createRoom(selectedMapId()).catch((err) => {
      menu.statusEl.textContent = String(err)
    })
  },
  onJoinRoom: (code) => {
    if (!code) {
      return
    }

    void mpSession.joinRoom(code, selectedMapId()).catch((err) => {
      menu.statusEl.textContent = String(err)
    })
  },
  onLeaveRoom: () => {
    mpSession.disconnect()
    clearRemotePlayers()
  },
})

mpSession.subscribe({
  onChange: (snap) => applyMpStatus(menu, snap),
  onStartGame: (mapId) => {
    if (currentScreen === "game") {
      return
    }
    
    if (mapId && menu.mapSelect.querySelector(`option[value="${mapId}"]`)) {
      menu.mapSelect.value = mapId
      rememberSelectedMapId(mapId)
    }
    void startGameSession()
  },
})

document.body.replaceChildren(menu.root, gameScreen, editor.root)
applyI18n()
onLocaleChange(() => {
  updateTitle()
  applyMenuI18n(menu)
  applyMpStatus(menu, mpSession.snapshot)
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
  setMobileControlsVisible(screen === "game" && prefersTouchControls())
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
      if (mpSession.ready) {
        mpSession.requestStart(id)
      }
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
    offsetGuestSpawn()
    menu.statusEl.textContent = ""
    return
  }

  ctx.endScreen = false
  clearRemotePlayers()
  reset()
  setupMap()
  offsetGuestSpawn()
  fadeTo([0, 0, 0, 0])
  gameStep(1)
  menu.statusEl.textContent = ""
}

function offsetGuestSpawn(): void {
  if (mpSession.snapshot.role !== "guest" || !ctx.camera) {
    return
  }
  ctx.camera.position = ctx.camera.position.add(newVector(18, 12, 0))
}

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
  applyMpStatus(menu, mpSession.snapshot)

  const params = new URLSearchParams(location.search)
  const room = params.get("room")
  if (room) {
    menu.roomInput.value = room.toUpperCase()
    void mpSession.joinRoom(room, selectedMapId()).catch((err) => {
      menu.statusEl.textContent = String(err)
    })
  } else {
    void mpSession.tryRestore(selectedMapId())
  }
}

void boot()
