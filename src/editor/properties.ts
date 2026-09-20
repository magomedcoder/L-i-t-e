import type { LevelData, ObjectType } from "../map/levelFormat"
import { objectPairId } from "../map/levelFormat"
import { t } from "../i18n"
import type { Selection } from "./types"
import type { EditorDom } from "./ui"

export type PropertiesHost = {
  dom: EditorDom
  level: () => LevelData
  selection: () => Selection
  syncingProps: { value: boolean }
  onObjectChange: () => void
  onPlayerChange: () => void
  onRegionChange: () => void
}

export function updatePropsVisibility(host: PropertiesHost): void {
  const selection = host.selection()
  const level = host.level()
  const { dom } = host

  dom.propsObjectEl.hidden = selection.kind !== "object"
  dom.propsPlayerEl.hidden = selection.kind !== "player"
  dom.propsRegionEl.hidden = selection.kind !== "region"
  dom.propsVertexEl.hidden = selection.kind !== "vertex"
  dom.selCountEl.hidden = selection.kind !== "object" || (selection.kind === "object" && level.objects[selection.index].type !== "many")
  dom.countWrapEl.hidden = dom.selCountEl.hidden
  const showPair = selection.kind === "object" && ["goal", "door"].includes(level.objects[selection.index].type)
  dom.pairPresetsEl.hidden = !showPair
  dom.pairHintEl.hidden = !showPair
  dom.selRotationWrapEl.hidden = selection.kind !== "object" || level.objects[selection.index].type !== "door"
}

export function syncPropsFromSelection(host: PropertiesHost): void {
  host.syncingProps.value = true
  updatePropsVisibility(host)

  const selection = host.selection()
  const level = host.level()
  const { dom } = host

  if (selection.kind === "object") {
    const obj = level.objects[selection.index]
    dom.selTypeEl.value = obj.type
    dom.selXEl.value = String(obj.x)
    dom.selYEl.value = String(obj.y)
    dom.selZEl.value = String(obj.z ?? 0)
    dom.selPairIdEl.value = String(Math.round((objectPairId(obj) * 180) / Math.PI))
    dom.selRotationEl.value = String(Math.round(((obj.theta ?? 0) * 180) / Math.PI))
    dom.selCountEl.value = String(obj.count ?? 1)
  } else if (selection.kind === "player") {
    const p = level.player || { x: 24, y: -16, z: 10 }
    dom.playerXEl.value = String(p.x)
    dom.playerYEl.value = String(p.y)
    dom.playerZEl.value = String(p.z ?? 10)
  } else if (selection.kind === "region") {
    const r = level.regions[selection.index]
    dom.regionIdEl.value = r.id ?? ""
    dom.regionTextureEl.value = r.texture != null ? String(r.texture) : ""
    dom.floorEl.value = String(r.floor)
    dom.ceilEl.value = String(r.ceil)
  } else if (selection.kind === "vertex") {
    const [vx, vy] = level.regions[selection.region].vertices[selection.vertex]
    dom.vertexInfoEl.textContent = t("validate.vertexInfo", {
      n: selection.vertex + 1,
      x: vx,
      y: vy,
    })
  }

  host.syncingProps.value = false
}

export function applyObjectProps(host: PropertiesHost): void {
  if (host.syncingProps.value || host.selection().kind !== "object") {
    return
  }

  const selection = host.selection()
  if (selection.kind !== "object") {
    return
  }

  const obj = host.level().objects[selection.index]
  const { dom } = host
  obj.type = dom.selTypeEl.value as ObjectType
  obj.x = Number(dom.selXEl.value) || 0
  obj.y = Number(dom.selYEl.value) || 0
  obj.z = Number(dom.selZEl.value) || 0
  const pairRad = ((Number(dom.selPairIdEl.value) || 0) * Math.PI) / 180
  if (obj.type === "goal") {
    obj.pairId = pairRad
  } else if (obj.type === "door") {
    obj.pairId = pairRad
    obj.theta = ((Number(dom.selRotationEl.value) || 0) * Math.PI) / 180
  } else {
    delete obj.pairId
    obj.theta = ((Number(dom.selRotationEl.value) || 0) * Math.PI) / 180
  }

  if (obj.type === "many") {
    obj.count = Math.max(1, Number(dom.selCountEl.value) || 1)
  } else {
    delete obj.count
  }

  host.onObjectChange()
}

export function applyPlayerProps(host: PropertiesHost): void {
  if (host.syncingProps.value || host.selection().kind !== "player") {
    return
  }

  const { dom } = host
  host.level().player = {
    x: Number(dom.playerXEl.value) || 0,
    y: Number(dom.playerYEl.value) || 0,
    z: Number(dom.playerZEl.value) || 10,
  }

  host.onPlayerChange()
}

export function applyRegionProps(host: PropertiesHost): void {
  if (host.syncingProps.value || host.selection().kind !== "region") {
    return
  }

  const selection = host.selection()
  if (selection.kind !== "region") {
    return
  }
  
  const region = host.level().regions[selection.index]
  const { dom } = host
  const id = dom.regionIdEl.value.trim()
  region.id = id || undefined
  const textureValue = dom.regionTextureEl.value
  region.texture = textureValue ? Number(textureValue) : undefined
  region.floor = Number(dom.floorEl.value) || 0
  region.ceil = Number(dom.ceilEl.value) || 40
  host.onRegionChange()
}
