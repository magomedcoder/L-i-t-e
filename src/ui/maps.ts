import type { MapEntry } from "../map/catalog"
import { el } from "./el"

export function fillMapSelect(select: HTMLSelectElement, maps: MapEntry[], selectedId: string): void {
  select.replaceChildren(...maps.map((m) => el("option", { 
    value: m.id 
  }, m.name || m.id)))
  select.value = selectedId
}
