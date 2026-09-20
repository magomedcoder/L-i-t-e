import { t } from "../i18n"
import { type Campaign, parseCampaign } from "./levelFormat"

export type MapEntry = {
  id: string
  name: string
  file: string
}

const mapFiles = import.meta.glob("../../maps/*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>

const SELECTED_MAP_KEY = "webgame_selected_map"

let catalog: MapEntry[] = []
let activeCampaign: Campaign | null = null

function storageKeyForMap(mapId: string): string {
  return `mapeditor_campaign:${mapId}`
}

function buildCatalog(): MapEntry[] {
  return Object.entries(mapFiles).map(([path, raw]) => {
    const file = path.split("/").pop()!
    const id = file.replace(/\.json$/i, "")
    const data = raw as { name?: string }
    return { id, name: data.name || id, file }
  }).sort((a, b) => a.name.localeCompare(b.name, "ru"))
}

function loadCampaignFile(file: string): Campaign {
  const path = Object.keys(mapFiles).find((entry) => entry.endsWith(`/${file}`))
  if (!path) {
    throw new Error(t("error.loadFailed", { file }))
  }

  return parseCampaign(mapFiles[path])
}

export function getActiveCampaign(): Campaign | null {
  return activeCampaign
}

export function setActiveCampaign(campaign: Campaign): void {
  activeCampaign = campaign
}

export async function loadCatalog(): Promise<MapEntry[]> {
  catalog = buildCatalog()
  if (!catalog.length) {
    throw new Error(t("error.noMaps"))
  }

  return catalog
}

export function getPreferredMapId(): string {
  const saved = localStorage.getItem(SELECTED_MAP_KEY) ?? localStorage.getItem("mapeditor_selected_map")
  if (saved && catalog.some((m) => m.id === saved)) {
    return saved
  }

  return catalog[0]?.id || "default"
}

export function rememberSelectedMapId(mapId: string): void {
  localStorage.setItem(SELECTED_MAP_KEY, mapId)
}

export async function loadCampaignById(mapId: string): Promise<Campaign> {
  const entry = catalog.find((m) => m.id === mapId)
  if (!entry) {
    throw new Error(t("error.mapNotFound", { id: mapId }))
  }

  const draft = loadCampaignDraft(mapId)
  const campaign = draft ? structuredClone(draft) : loadCampaignFile(entry.file)
  rememberSelectedMapId(mapId)
  setActiveCampaign(campaign)
  return campaign
}

export function fetchCampaignFile(file: string): Promise<Campaign> {
  return Promise.resolve(structuredClone(loadCampaignFile(file)))
}

function loadCampaignDraft(mapId: string): Campaign | null {
  try {
    const raw = localStorage.getItem(storageKeyForMap(mapId))
    if (!raw) {
      return null
    }

    return parseCampaign(JSON.parse(raw))
  } catch {
    return null
  }
}

export function saveCampaignDraft(mapId: string, campaign: Campaign): void {
  localStorage.setItem(storageKeyForMap(mapId), JSON.stringify(campaign))
}

export function clearCampaignDraft(mapId: string): void {
  localStorage.removeItem(storageKeyForMap(mapId))
}

export async function loadEditorCampaign(mapId: string): Promise<Campaign> {
  const draft = loadCampaignDraft(mapId)
  if (draft) {
    return structuredClone(draft)
  }

  const entry = catalog.find((m) => m.id === mapId)
  if (!entry) {
    throw new Error(t("error.mapNotFound", { id: mapId }))
  }

  return structuredClone(loadCampaignFile(entry.file))
}
