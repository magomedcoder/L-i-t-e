import { t } from "../i18n"

export type ObjectType = | "enemy" | "flying" | "health" | "goal" | "door" | "flashlight" | "many"

export const OBJECT_TYPES: ObjectType[] = ["enemy", "flying", "health", "goal", "door", "flashlight", "many"]

export type LevelRegion = {
  id?: string
  texture?: number
  vertices: [number, number][]
  floor: number
  ceil: number
}

export type LevelObject = {
  type: ObjectType
  x: number
  y: number
  z?: number
  theta?: number
  pairId?: number
  count?: number
}

export type LevelData = {
  name?: string
  notes?: string
  tags?: string[]
  player?: {
    x: number
    y: number
    z?: number
  }
  regions: LevelRegion[]
  objects: LevelObject[]
}

export type Campaign = {
  name?: string
  author?: string
  difficulty?: number
  levels: LevelData[]
}

export function objectPairId(obj: LevelObject): number {
  return obj.pairId ?? obj.theta ?? 0
}

export function migrateCampaign(raw: unknown): Campaign {
  const data = structuredClone(raw) as Campaign
  if (!data || !Array.isArray(data.levels)) {
    throw new Error(t("error.invalidCampaign"))
  }

  data.levels.forEach((level) => {
    if (!Array.isArray(level.objects)) {
      level.objects = []
    }
    level.objects.forEach((obj) => {
      if ((obj.type === "goal" || obj.type === "door") && obj.pairId == null && obj.theta != null) {
        obj.pairId = obj.theta
      }
    })
  })

  return data
}

export function isEnemyType(type: ObjectType): boolean {
  return type === "enemy" || type === "flying" || type === "many"
}

export function parseCampaign(raw: unknown): Campaign {
  const data = migrateCampaign(raw)
  data.levels.forEach((level, i) => validateLevel(level, i))
  return data
}

export function parseCampaignText(text: string): Campaign {
  return parseCampaign(JSON.parse(text))
}

function validateLevel(level: LevelData, index?: number): void {
  const where = index == null ? t("error.level") : t("error.levelNumbered", { n: index + 1 })
  if (!level || !Array.isArray(level.regions) || !level.regions.length) {
    throw new Error(t("error.noRegions", { where }))
  }

  level.regions.forEach((r, ri) => {
    if (!r.vertices || r.vertices.length < 3) {
      throw new Error(t("error.minVertices", { where, region: ri + 1 }))
    }
  })

  if (!Array.isArray(level.objects)) {
    level.objects = []
  }
}
