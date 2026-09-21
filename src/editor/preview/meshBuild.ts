import type { LevelData, LevelObject, LevelRegion } from "../../map/levelFormat"
import { objectPairId } from "../../map/levelFormat"
import { defaultRegionTexture } from "../../map/textures"
import { edgeKey } from "../../map/geometry"
import { pairs, transpose } from "../../math/helpers"

export type Vec3 = {
  x: number
  y: number
  z: number
}

export type Tri = {
  a: Vec3
  b: Vec3
  c: Vec3
  color: [number, number, number, number]
  kind: "floor" | "ceil" | "wall" | "object" | "player" | "link" | "helper" | "gizmo"
  region?: number
  object?: number
  selected?: boolean
}

export type PreviewMesh = {
  tris: Tri[]
  bounds: {
    min: Vec3
    max: Vec3
  }
}

const TEX_COLOR: Record<number, [number, number, number]> = {
  20: [0.35, 0.55, 0.32],
  21: [0.45, 0.48, 0.55],
  22: [0.38, 0.42, 0.52],
}

const OBJ_COLOR: Record<string, [number, number, number]> = {
  enemy: [0.9, 0.25, 0.2],
  flying: [0.95, 0.55, 0.15],
  health: [0.2, 0.85, 0.35],
  goal: [1, 0.85, 0.2],
  door: [0.55, 0.35, 0.9],
  flashlight: [0.9, 0.9, 0.4],
  many: [0.95, 0.4, 0.4],
}

function v(x: number, y: number, z: number): Vec3 {
  return { x, y, z }
}

function fanTris(
  verts: Vec3[],
  color: [number, number, number, number],
  kind: Tri["kind"],
  region?: number,
): Tri[] {
  if (verts.length < 3) {
    return []
  }
  
  const out: Tri[] = []
  for (let i = 1; i < verts.length - 1; i++) {
    out.push({ a: verts[0], b: verts[i], c: verts[i + 1], color, kind, region })
  }

  return out
}

function boxTris(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: [number, number, number, number], kind: Tri["kind"], object?: number): Tri[] {
  const hx = sx / 2
  const hy = sy / 2
  const hz = sz / 2
  const p = [
    v(cx - hx, cy - hy, cz - hz),
    v(cx + hx, cy - hy, cz - hz),
    v(cx + hx, cy + hy, cz - hz),
    v(cx - hx, cy + hy, cz - hz),
    v(cx - hx, cy - hy, cz + hz),
    v(cx + hx, cy - hy, cz + hz),
    v(cx + hx, cy + hy, cz + hz),
    v(cx - hx, cy + hy, cz + hz),
  ]
  const faces: number[][] = [
    [0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [2, 6, 7, 3], [0, 3, 7, 4], [1, 5, 6, 2],
  ]
  const tris: Tri[] = []
  
  for (const f of faces) {
    tris.push(
      {
        a: p[f[0]],
        b: p[f[1]],
        c: p[f[2]],
        color,
        kind,
        object
      },
      {
        a: p[f[0]],
        b: p[f[2]],
        c: p[f[3]],
        color,
        kind,
        object
      },
    )
  }

  return tris
}

function regionColor(region: LevelRegion, selected: boolean, ghost: boolean): [number, number, number, number] {
  const tex = region.texture ?? defaultRegionTexture(region.floor)
  const base = TEX_COLOR[tex] || TEX_COLOR[22]
  const a = ghost ? 0.22 : selected ? 0.95 : 0.72
  const boost = selected ? 1.25 : 1
  return [Math.min(1, base[0] * boost), Math.min(1, base[1] * boost), Math.min(1, base[2] * boost), a]
}

export type MeshBuildOptions = {
  layers: {
    regions: boolean
    objects: boolean
    player: boolean
    grid?: boolean
    helpers?: boolean
  }
  objectFilter: string
  selectedRegion?: number
  selectedObject?: number
  selectedObjects?: number[]
  selectedVertex?: {
    region: number
    vertex: number
  }
  sectionZ?: number | null
  ghostMode?: boolean
  draftVerts?: [number, number][]
  draftFloor?: number
  showLinks?: boolean
  showAxis?: boolean
  chunkLimit?: number
  chunkOffset?: number
}

function updateBounds(b: { min: Vec3; max: Vec3 }, p: Vec3): void {
  b.min.x = Math.min(b.min.x, p.x)
  b.min.y = Math.min(b.min.y, p.y)
  b.min.z = Math.min(b.min.z, p.z)
  b.max.x = Math.max(b.max.x, p.x)
  b.max.y = Math.max(b.max.y, p.y)
  b.max.z = Math.max(b.max.z, p.z)
}

function collectWallEdges(regions: LevelRegion[]): Record<string, number[][]> {
  const wallEdges: Record<string, number[][]> = {}
  regions.forEach((region) => {
    const verts = region.vertices.map(([x, y]) => v(x, y, 0))
    pairs([...verts, verts[0]], (a, b) => {
      const key = edgeKey(a, b)
      ;(wallEdges[key] ||= []).push([region.floor, region.ceil])
    })
  })
  return wallEdges
}

function passesSection(z0: number, z1: number, sectionZ: number | null | undefined): boolean {
  if (sectionZ == null || !Number.isFinite(sectionZ)) {
    return true
  }

  const lo = Math.min(z0, z1)
  const hi = Math.max(z0, z1)
  return lo <= sectionZ && sectionZ <= hi
}

function isGhostRegion(region: LevelRegion, sectionZ: number | null | undefined, ghostMode: boolean | undefined): boolean {
  if (!ghostMode || sectionZ == null) {
    return false
  }

  return region.floor > sectionZ + 0.5 || region.ceil < sectionZ - 0.5
}

export function buildPreviewMesh(level: LevelData, opts: MeshBuildOptions): PreviewMesh {
  const tris: Tri[] = []
  const bounds = {
    min: v(Infinity, Infinity, Infinity),
    max: v(-Infinity, -Infinity, -Infinity),
  }

  const regionStart = opts.chunkOffset || 0
  const regionEnd = opts.chunkLimit != null
    ? Math.min(level.regions.length, regionStart + opts.chunkLimit)
    : level.regions.length

  if (opts.layers.regions) {
    for (let ri = regionStart; ri < regionEnd; ri++) {
      const region = level.regions[ri]
      const selected = opts.selectedRegion === ri
      const ghost = isGhostRegion(region, opts.sectionZ, opts.ghostMode)
      if (opts.sectionZ != null && !passesSection(region.floor, region.ceil, opts.sectionZ) && !opts.ghostMode) {
        continue
      }

      const col = regionColor(region, selected, ghost)
      const floorVerts = region.vertices.map(([x, y]) => v(x, y, region.floor))
      const ceilVerts = region.vertices.map(([x, y]) => v(x, y, region.ceil))
      for (const t of fanTris(floorVerts, col, "floor", ri)) {
        tris.push(t)
        updateBounds(bounds, t.a)
      }

      const ceilCol: [number, number, number, number] = [col[0] * 0.7, col[1] * 0.7, col[2] * 0.75, col[3] * 0.85]
      for (const t of fanTris(ceilVerts, ceilCol, "ceil", ri)) {
        tris.push(t)
      }
    }

    const wallEdges = collectWallEdges(level.regions.slice(regionStart, regionEnd))
    Object.entries(wallEdges).forEach(([coord, edgeHeights]) => {
      const [a, b, c, d] = coord.split(",").map(Number)
      transpose(edgeHeights).forEach((delta) => {
        if (!passesSection(delta[0], delta[1] || 0, opts.sectionZ) && !opts.ghostMode) {
          return
        }

        const z0 = delta[0]
        const z1 = delta[1] || 0
        const color: [number, number, number, number] = [0.55, 0.58, 0.65, 0.9]
        const p0 = v(a, b, z0)
        const p1 = v(c, d, z0)
        const p2 = v(c, d, z1)
        const p3 = v(a, b, z1)
        tris.push({
          a: p0,
          b: p1,
          c: p2,
          color,
          kind: "wall"
        })
        tris.push({
          a: p0,
          b: p2,
          c: p3,
          color,
          kind: "wall"
        })
        updateBounds(bounds, p0)
        updateBounds(bounds, p2)
      })
    })
  }

  if (opts.layers.objects) {
    level.objects.forEach((obj, oi) => {
      if (opts.objectFilter && obj.type !== opts.objectFilter) {
        return
      }

      const multi = opts.selectedObjects?.includes(oi)
      const selected = opts.selectedObject === oi || multi
      addObjectMarkers(tris, bounds, obj, oi, selected)
    })
  }

  if (opts.layers.player && level.player) {
    const p = level.player
    const z = (p.z ?? 10)
    const col: [number, number, number, number] = [0.2, 0.75, 1, 1]
    for (const t of boxTris(p.x, p.y, z, 6, 6, 12, col, "player")) {
      tris.push(t)
      updateBounds(bounds, t.a)
    }
    
    
    const tip = v(p.x + 10, p.y, z)
    tris.push({
      a: v(p.x, p.y - 2, z),
      b: tip,
      c: v(p.x, p.y + 2, z),
      color: [0.3, 0.9, 1, 1],
      kind: "player",
    })
  }

  if (opts.showLinks) {
    addPairLinks(tris, level)
  }

  if (opts.draftVerts && opts.draftVerts.length) {
    const z = opts.draftFloor ?? 4
    const pts = opts.draftVerts.map(([x, y]) => v(x, y, z + 0.5))
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      tris.push({
        a: v(a.x, a.y, a.z),
        b: v(b.x, b.y, b.z),
        c: v(a.x, a.y, a.z + 1),
        color: [1, 0.9, 0.2, 1],
        kind: "helper",
      })
    }
  }

  if (opts.showAxis !== false) {
    const o = v(0, 0, 0)
    tris.push({
      a: o,
      b: v(24, 0, 0),
      c: v(0, 2, 0),
      color: [1, 0.2, 0.2, 1],
      kind: "gizmo"
    })
    tris.push({
      a: o,
      b: v(0, 24, 0),
      c: v(2, 0, 0),
      color: [0.2, 1, 0.2, 1],
      kind: "gizmo"
    })
    tris.push({
      a: o,
      b: v(0, 0, 24),
      c: v(2, 0, 0),
      color: [0.2, 0.4, 1, 1],
      kind: "gizmo"
    })
  }

  if (opts.selectedVertex) {
    const { region, vertex } = opts.selectedVertex
    const r = level.regions[region]
    if (r?.vertices[vertex]) {
      const [x, y] = r.vertices[vertex]
      const z = r.floor
      for (const t of boxTris(x, y, z + 2, 3, 3, 4, [1, 1, 0.2, 1], "helper")) {
        tris.push(t)
      }
    }
  }

  if (!Number.isFinite(bounds.min.x)) {
    bounds.min = v(-50, -50, 0)
    bounds.max = v(50, 50, 40)
  }

  return { tris, bounds }
}

function addObjectMarkers(tris: Tri[], bounds: { min: Vec3; max: Vec3 }, obj: LevelObject, oi: number, selected: boolean): void {
  const base = OBJ_COLOR[obj.type] || [0.8, 0.8, 0.8]
  const boost = selected ? 1.3 : 1
  const color: [number, number, number, number] = [
    Math.min(1, base[0] * boost),
    Math.min(1, base[1] * boost),
    Math.min(1, base[2] * boost),
    1,
  ]

  const z = (obj.z ?? 0) + 6
  const size = obj.type === "door" ? 10 : obj.type === "flying" ? 8 : 6
  const h = obj.type === "door" ? 18 : 8
  
  for (const t of boxTris(obj.x, obj.y, z, size, size, h, color, "object", oi)) {
    tris.push(t)
    updateBounds(bounds, t.a)
  }

  if (obj.type === "many") {
    const count = Math.min(obj.count || 1, 8)
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2
      const ox = obj.x + Math.cos(ang) * 10
      const oy = obj.y + Math.sin(ang) * 10
      for (const t of boxTris(ox, oy, z, 4, 4, 6, [color[0], color[1], color[2], 0.7], "object", oi)) {
        tris.push(t)
      }
    }
  }

  if (obj.theta != null && (obj.type === "door" || obj.type === "flashlight")) {
    const dx = Math.cos(obj.theta) * 12
    const dy = Math.sin(obj.theta) * 12
    tris.push({
      a: v(obj.x, obj.y, z),
      b: v(obj.x + dx, obj.y + dy, z),
      c: v(obj.x + dx * 0.8, obj.y + dy * 0.8, z + 2),
      color: [1, 1, 1, 1],
      kind: "helper",
      object: oi,
    })
  }
}

function addPairLinks(tris: Tri[], level: LevelData): void {
  const goals = level.objects.map((o, i) => ({ o, i })).filter(({ o }) => o.type === "goal")
  const doors = level.objects.map((o, i) => ({ o, i })).filter(({ o }) => o.type === "door")
  goals.forEach(({ o: goal }) => {
    const pid = objectPairId(goal)
    const door = doors.find(({ o }) => objectPairId(o) === pid)
    if (!door) {
      return
    }

    const gz = (goal.z ?? 0) + 10
    const dz = (door.o.z ?? 0) + 10
    const hue = ((pid % 360) + 360) % 360
    const rgb = hslToRgb(hue / 360, 0.7, 0.55)
    tris.push({
      a: v(goal.x, goal.y, gz),
      b: v(door.o.x, door.o.y, dz),
      c: v((goal.x + door.o.x) / 2, (goal.y + door.o.y) / 2, (gz + dz) / 2 + 2),
      color: [rgb[0], rgb[1], rgb[2], 0.85],
      kind: "link",
    })
  })
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hue2rgb = (t: number) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }

  return [hue2rgb(h + 1 / 3), hue2rgb(h), hue2rgb(h - 1 / 3)]
}

export function chunkRegionRanges(total: number, chunkSize = 80): { offset: number; limit: number }[] {
  const out: { offset: number; limit: number }[] = []
  for (let i = 0; i < total; i += chunkSize) {
    out.push({ 
      offset: i,
      limit: Math.min(chunkSize, total - i)
    })
  }

  return out.length ? out : [{
    offset: 0,
    limit: 0
  }]
}
