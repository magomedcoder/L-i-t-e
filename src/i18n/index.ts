import { en } from "./en"
import { ru } from "./ru"

export type Locale = keyof typeof bundles
export type MessageKey = keyof typeof ru

const bundles = { ru, en } as const
const STORAGE_KEY = "webgame_locale"

let locale: Locale = "ru"
const listeners: Array<() => void> = []

export function getLocale(): Locale {
  return locale
}

export function initLocale(): Locale {
  const saved = (localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem("game_locale")) as Locale | null
  if (saved && saved in bundles) {
    locale = saved
  } else {
    locale = navigator.language.toLowerCase().startsWith("ru") ? "ru" : "en"
  }

  document.documentElement.lang = locale
  return locale
}

export function setLocale(next: Locale): void {
  if (!(next in bundles) || locale === next) {
    return
  }

  locale = next
  localStorage.setItem(STORAGE_KEY, next)
  document.documentElement.lang = next
  listeners.forEach((listener) => listener())
}

export function onLocaleChange(listener: () => void): void {
  listeners.push(listener)
}

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  let text: string = bundles[locale][key] ?? bundles.ru[key] ?? key
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value))
    }
  }
  
  return text
}

export function applyI18n(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((node) => {
    const key = node.dataset.i18n as MessageKey
    node.textContent = t(key)
  })
}
