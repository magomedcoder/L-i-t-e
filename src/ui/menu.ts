import { button, el } from "./el"
import { applyI18n, getLocale, setLocale, t, type Locale, type MessageKey } from "../i18n"
import type { SessionSnapshot } from "../net/types"

type MenuDom = {
  root: HTMLElement
  mapSelect: HTMLSelectElement
  localeSelect: HTMLSelectElement
  statusEl: HTMLElement
  roomInput: HTMLInputElement
  mpStatusEl: HTMLElement
  roomCodeEl: HTMLElement
  shareLinkEl: HTMLAnchorElement
  createRoomBtn: HTMLButtonElement
  joinRoomBtn: HTMLButtonElement
  leaveRoomBtn: HTMLButtonElement
}

export function createMenuScreen(handlers: {
  onPlay: () => void
  onEditor: () => void
  onCreateRoom: () => void
  onJoinRoom: (code: string) => void
  onLeaveRoom: () => void
}): MenuDom {
  const mapSelect = el("select", {
    id: "mapSelect",
    className: "map-select",
  }) as HTMLSelectElement

  const localeSelect = el("select", {
    id: "localeSelect",
    className: "locale-select",
  }) as HTMLSelectElement
  localeSelect.append(
    el("option", { value: "ru" }, t("locale.ru")),
    el("option", { value: "en" }, t("locale.en")),
  )
  localeSelect.value = getLocale()

  const statusEl = el("p", {
    className: "menu-status",
  }, "")

  const roomInput = el("input", {
    id: "roomCode",
    className: "room-input",
    type: "text",
    maxlength: 4,
    placeholder: "ABCD",
    autocomplete: "off",
    spellcheck: false,
  }) as HTMLInputElement

  const mpStatusEl = el("p", { className: "mp-status", dataset: { i18n: "mp.idle" } }, t("mp.idle"))
  const roomCodeEl = el("span", { className: "mp-room-code" }, "")
  const shareLinkEl = el("a", {
    className: "mp-share-link",
    href: "#",
    hidden: true,
    target: "_blank",
    rel: "noopener",
  }, t("mp.copyLink")) as HTMLAnchorElement

  const createRoomBtn = button(t("mp.create"), {
    id: "btnCreateRoom",
    dataset: { i18n: "mp.create" },
  }, handlers.onCreateRoom)
  const joinRoomBtn = button(t("mp.join"), {
    id: "btnJoinRoom",
    dataset: { i18n: "mp.join" },
  }, () => handlers.onJoinRoom(roomInput.value.trim()))
  const leaveRoomBtn = button(t("mp.leave"), {
    id: "btnLeaveRoom",
    className: "mp-leave",
    hidden: true,
    dataset: { i18n: "mp.leave" },
  }, handlers.onLeaveRoom)

  const root = el("div", { id: "screen-menu", className: "screen active" },
    el("div", { className: "menu" },
      el("h1", { dataset: { i18n: "app.title" } }, t("app.title")),
      el("label", { className: "menu-label", htmlFor: "mapSelect", dataset: { i18n: "menu.map" } }, t("menu.map")),
      mapSelect,
      el("label", { className: "menu-label", htmlFor: "localeSelect", dataset: { i18n: "menu.language" } }, t("menu.language")),
      localeSelect,
      statusEl,
      el("div", { className: "menu-actions" },
        button(t("menu.play"), { className: "primary", id: "btnPlay", dataset: { i18n: "menu.play" } }, handlers.onPlay),
      ),
      el("div", { className: "mp-panel" },
        el("div", { className: "menu-label", dataset: { i18n: "mp.title" } }, t("mp.title")),
        mpStatusEl,
        el("div", { className: "mp-room-row" }, roomCodeEl, shareLinkEl),
        el("div", { className: "mp-actions" },
          createRoomBtn,
          el("div", { className: "mp-join-row" }, roomInput, joinRoomBtn),
          leaveRoomBtn,
        ),
      ),
    ),
    button(t("menu.editor"), {
      className: "menu-editor-btn",
      id: "btnEditor",
      dataset: { i18n: "menu.editor" },
    }, handlers.onEditor),
  )

  const menu = {
    root,
    mapSelect,
    localeSelect,
    statusEl,
    roomInput,
    mpStatusEl,
    roomCodeEl,
    shareLinkEl,
    createRoomBtn,
    joinRoomBtn,
    leaveRoomBtn,
  }
  localeSelect.addEventListener("change", () => {
    setLocale(localeSelect.value as Locale)
    applyMenuI18n(menu)
  })
  roomInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      handlers.onJoinRoom(roomInput.value.trim())
    }
  })
  applyMenuI18n(menu)
  return menu
}

export function applyMenuI18n(menu: Pick<MenuDom, "root" | "localeSelect" | "shareLinkEl">): void {
  applyI18n(menu.root)
  menu.localeSelect.options[0].textContent = t("locale.ru")
  menu.localeSelect.options[1].textContent = t("locale.en")
  if (!menu.shareLinkEl.hidden) {
    menu.shareLinkEl.textContent = t("mp.copyLink")
  }
}

export function applyMpStatus(menu: MenuDom, snap: SessionSnapshot): void {
  const inRoom = !!snap.room && snap.status !== "idle"
  menu.leaveRoomBtn.hidden = !inRoom
  menu.createRoomBtn.disabled = inRoom && snap.status !== "error" && snap.status !== "disconnected"
  menu.joinRoomBtn.disabled = menu.createRoomBtn.disabled
  menu.roomInput.disabled = menu.createRoomBtn.disabled

  if (snap.room) {
    menu.roomCodeEl.textContent = snap.room
    menu.roomInput.value = snap.room
  } else {
    menu.roomCodeEl.textContent = ""
  }

  if (snap.shareUrl) {
    menu.shareLinkEl.hidden = false
    menu.shareLinkEl.href = snap.shareUrl
    menu.shareLinkEl.onclick = (e) => {
      e.preventDefault()
      void navigator.clipboard.writeText(snap.shareUrl!).then(() => {
        menu.shareLinkEl.textContent = t("mp.copied")
        setTimeout(() => {
          menu.shareLinkEl.textContent = t("mp.copyLink")
        }, 1200)
      })
    }
  } else {
    menu.shareLinkEl.hidden = true
  }

  const key: MessageKey =
    snap.status === "waiting" ? "mp.waiting"
      : snap.status === "connecting" || snap.status === "signaling" ? "mp.connecting"
        : snap.status === "connected" ? "mp.connected"
          : snap.status === "reconnecting" ? "mp.reconnecting"
            : snap.status === "disconnected" ? "mp.disconnected"
              : snap.status === "error" ? "mp.error"
                : "mp.idle"

  menu.mpStatusEl.dataset.i18n = key
  menu.mpStatusEl.textContent = snap.status === "error" && snap.error
    ? t("mp.error", { reason: snap.error })
    : t(key)
}
