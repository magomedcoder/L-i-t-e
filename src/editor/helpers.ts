import type { LevelData, ObjectType } from "../map/levelFormat"
import { t, type MessageKey } from "../i18n"

export function objectLabel(type: ObjectType): string {
  return t(`object.${type}` as MessageKey)
}

export function emptyLevel(name = t("level.new")): LevelData {
  return {
    name,
    player: { x: 24, y: -16, z: 10 },
    regions: [
      {
        vertices: [
          [0, 0],
          [64, 0],
          [64, 64],
          [0, 64],
        ],
        floor: 4,
        ceil: 40,
      },
    ],
    objects: [],
  }
}
