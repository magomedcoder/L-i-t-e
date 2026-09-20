import { t } from "../i18n"

export type RegionTextureId = 20 | 21 | 22

export type RegionTextureOption = {
  value: RegionTextureId | ""
  labelKey: "texture.auto" | "texture.floor" | "texture.floorLow" | "texture.ceil"
}

export const REGION_TEXTURE_OPTIONS: RegionTextureOption[] = [
  { value: "", labelKey: "texture.auto" },
  { value: 22, labelKey: "texture.floor" },
  { value: 20, labelKey: "texture.floorLow" },
  { value: 21, labelKey: "texture.ceil" },
]

export function regionTextureLabel(value: RegionTextureId | "" | undefined): string {
  const id = value ?? ""
  const entry = REGION_TEXTURE_OPTIONS.find((option) => option.value === id)
  return entry ? t(entry.labelKey) : t("texture.auto")
}

export function defaultRegionTexture(floor: number): RegionTextureId {
  return floor < 0 ? 20 : 22
}
