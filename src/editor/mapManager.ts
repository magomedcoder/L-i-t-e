import type { Campaign, LevelData } from "../map/levelFormat"
import { parseCampaign } from "../map/levelFormat"
import { clearCampaignDraft, fetchCampaignFile, saveCampaignDraft } from "../map/catalog"
import type { MapEntry } from "../map/catalog"
const CUSTOM_KEY = "mapeditor_custom_maps"

export type CustomMapMeta = {
  id: string
  name: string
}

function loadCustomMeta(): CustomMapMeta[] {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]") as CustomMapMeta[]
  } catch {
    return []
  }
}

function saveCustomMeta(list: CustomMapMeta[]): void {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(list))
}

export function listCustomMaps(): CustomMapMeta[] {
  return loadCustomMeta()
}

export function createNewMapDraft(name: string): { id: string; campaign: Campaign } {
  const id = `custom_${Date.now().toString(36)}`
  const campaign: Campaign = {
    name,
    author: "",
    difficulty: 1,
    levels: [
      {
        name: "Level 1",
        player: {
          x: 0,
          y: 0,
          z: 10
        },
        regions: [{
          vertices: [[-32, -32], [32, -32], [32, 32], [-32, 32]],
          floor: 4,
          ceil: 40,
        }],
        objects: [],
      }
    ],
  }
  saveCampaignDraft(id, campaign)
  const meta = loadCustomMeta()
  meta.push({ id, name })
  saveCustomMeta(meta)
  return { id, campaign }
}

export function renameMapDraft(id: string, name: string, campaign: Campaign): void {
  campaign.name = name
  saveCampaignDraft(id, campaign)
  const meta = loadCustomMeta()
  const entry = meta.find((m) => m.id === id)
  if (entry) {
    entry.name = name
    saveCustomMeta(meta)
  }
}

export function duplicateMapDraft(sourceId: string, campaign: Campaign): { id: string; campaign: Campaign } {
  const id = `custom_${Date.now().toString(36)}`
  const copy = structuredClone(campaign)
  copy.name = `${campaign.name || sourceId} (copy)`
  saveCampaignDraft(id, copy)
  const meta = loadCustomMeta()
  meta.push({ id, name: copy.name || id })
  saveCustomMeta(meta)
  return { id, campaign: copy }
}

export function deleteMapDraft(id: string): void {
  clearCampaignDraft(id)
  saveCustomMeta(loadCustomMeta().filter((m) => m.id !== id))
}

export function mergeCatalogWithCustom(catalog: MapEntry[]): MapEntry[] {
  const customs = loadCustomMeta().map((m) => ({
    id: m.id,
    name: m.name,
    file: `${m.id}.json`,
  }))
  const ids = new Set(catalog.map((c) => c.id))
  return [...catalog, ...customs.filter((c) => !ids.has(c.id))]
}

export async function diffDraftVsShipped(
  mapId: string,
  draft: Campaign,
  catalog: MapEntry[],
): Promise<{ changed: boolean; summary: string }> {
  const entry = catalog.find((m) => m.id === mapId)
  if (!entry || mapId.startsWith("custom_")) {
    return {
      changed: true,
      summary: "custom / no shipped original"
    }
  }

  try {
    const shipped = await fetchCampaignFile(entry.file)
    const a = JSON.stringify(shipped)
    const b = JSON.stringify(draft)
    if (a === b) {
      return {
        changed: false,
        summary: "identical to shipped"
      }
    }

    const levelDiff = (draft.levels?.length || 0) - (shipped.levels?.length || 0)
    const regionDiff = (draft.levels?.[0]?.regions?.length || 0) - (shipped.levels?.[0]?.regions?.length || 0)
    return {
      changed: true,
      summary: `diff: levelsΔ=${levelDiff}, L1 regionsΔ=${regionDiff}, bytes ${b.length - a.length >= 0 ? "+" : ""}${b.length - a.length}`,
    }
  } catch {
    return {
      changed: true,
      summary: "could not load shipped"
    }
  }
}

export function exportLevelJson(level: LevelData): string {
  return JSON.stringify(level, null, 2)
}

export function importLevelIntoCampaign(campaign: Campaign, raw: unknown, replaceIndex?: number): void {
  const level = raw as LevelData
  if (!level || !Array.isArray(level.regions)) {
    throw new Error("Invalid level JSON")
  }

  if (replaceIndex != null && replaceIndex >= 0 && replaceIndex < campaign.levels.length) {
    campaign.levels[replaceIndex] = level
  } else {
    campaign.levels.push(level)
  }
}

export function markPendingApply(mapId: string, campaign: Campaign): void {
  localStorage.setItem(`mapeditor_pending_apply:${mapId}`, JSON.stringify(campaign))
}

export function peekPendingApply(mapId: string): Campaign | null {
  try {
    const raw = localStorage.getItem(`mapeditor_pending_apply:${mapId}`)
    return raw ? parseCampaign(JSON.parse(raw)) : null
  } catch {
    return null
  }
}
