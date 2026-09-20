import { button, el } from "./el"
import { applyI18n, getLocale, setLocale, t, type Locale } from "../i18n"

type MenuDom = {
  root: HTMLElement
  mapSelect: HTMLSelectElement
  localeSelect: HTMLSelectElement
  statusEl: HTMLElement
  fileInput: HTMLInputElement
}

export function createMenuScreen(handlers: {
  onPlay: () => void
  onEditor: () => void
  onPickFile: () => void
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
  const fileInput = el("input", {
    type: "file",
    accept: "application/json,.json",
    hidden: true,
  }) as HTMLInputElement

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
        button(t("menu.editor"), { id: "btnEditor", dataset: { i18n: "menu.editor" } }, handlers.onEditor),
        button(t("menu.loadFile"), { id: "btnLoadMap", dataset: { i18n: "menu.loadFile" } }, handlers.onPickFile),
      ),
      fileInput,
    ),
  )

  const menu = { root, mapSelect, localeSelect, statusEl, fileInput }
  localeSelect.addEventListener("change", () => {
    setLocale(localeSelect.value as Locale)
    applyMenuI18n(menu)
  })
  applyMenuI18n(menu)
  return menu
}

export function applyMenuI18n(menu: Pick<MenuDom, "root" | "localeSelect">): void {
  applyI18n(menu.root)
  menu.localeSelect.options[0].textContent = t("locale.ru")
  menu.localeSelect.options[1].textContent = t("locale.en")
}
