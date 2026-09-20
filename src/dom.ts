import { el } from "./ui/el"
import { t } from "./i18n"

export const loadProgress = el("span", { id: "loadProgress" }, "0%")
export const titleEl = el(
  "div",
  { id: "title" },
  el("div", { className: "b" }, el("span", { dataset: { i18n: "load.title" } }, t("load.title")), " ", loadProgress),
)
export const healthFill = el("div", { id: "healthFill" })
export const healthValue = el("span", { id: "healthValue" }, "100%")
export const healthBar = el(
  "div",
  { id: "healthBar" },
  el("div", { className: "health-label" }, healthValue),
  el("div", { className: "health-track" }, healthFill),
)
export const hudRoot = el("div", { id: "hud" }, titleEl)
export const canvas = el("canvas", { id: "gameCanvas" })
export const backToEditorBtn = el("button", {
  id: "backToEditor",
  className: "back-to-editor",
  hidden: true,
  dataset: { i18n: "menu.backEditor" },
}, t("menu.backEditor"))
export const gameScreen = el("div", { id: "screen-game", className: "screen" }, canvas, hudRoot, healthBar, backToEditorBtn)
