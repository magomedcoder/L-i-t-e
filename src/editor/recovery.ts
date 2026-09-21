import { clearCampaignDraft, saveCampaignDraft, type MapEntry } from "../map/catalog"
import type { Campaign } from "../map/levelFormat"
import { parseCampaign } from "../map/levelFormat"

const RECOVERY_KEY = "mapeditor_recovery_index"

export type DraftInfo = {
  mapId: string
  name: string
  savedAt: number
  size: number
}

function draftKey(mapId: string): string {
  return `mapeditor_campaign:${mapId}`
}

export function listRecoverableDrafts(catalog: MapEntry[]): DraftInfo[] {
  const out: DraftInfo[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith("mapeditor_campaign:")) {
      continue
    }

    const mapId = key.slice("mapeditor_campaign:".length)
    const raw = localStorage.getItem(key)
    if (!raw) {
      continue
    }

    try {
      const campaign = parseCampaign(JSON.parse(raw))
      const entry = catalog.find((m) => m.id === mapId)
      out.push({
        mapId,
        name: campaign.name || entry?.name || mapId,
        savedAt: readStamp(mapId),
        size: raw.length,
      })
    } catch {}
  }
  return out.sort((a, b) => b.savedAt - a.savedAt)
}

function readStamp(mapId: string): number {
  const n = Number(localStorage.getItem(`${RECOVERY_KEY}:${mapId}`) || 0)
  return n || 0
}

export function touchDraftStamp(mapId: string): void {
  localStorage.setItem(`${RECOVERY_KEY}:${mapId}`, String(Date.now()))
}

export function saveDraftWithStamp(mapId: string, campaign: Campaign): void {
  saveCampaignDraft(mapId, campaign)
  touchDraftStamp(mapId)
}

export function discardDraft(mapId: string): void {
  clearCampaignDraft(mapId)
  localStorage.removeItem(`${RECOVERY_KEY}:${mapId}`)
}

export function hasDraft(mapId: string): boolean {
  return localStorage.getItem(draftKey(mapId)) != null
}
