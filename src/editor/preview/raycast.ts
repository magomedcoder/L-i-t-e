import type { LevelData } from "../../map/levelFormat"
import { pointInPolygon } from "../../map/geometry"
import type { Camera3D } from "./camera3d"
import { cameraEye } from "./camera3d"
import type { Tri, Vec3 } from "./meshBuild"

export type Ray = {
  origin: Vec3
  dir: Vec3
}

export type Hit = | {
  kind: "region"
  index: number
  point: Vec3
  t: number
  face: "floor" | "ceil" | "wall"
} | {
  kind: "object"
  index: number
  point: Vec3
  t: number
} | {
  kind: "player"
  point: Vec3
  t: number
} | {
  kind: "vertex"
  region: number
  vertex: number
  point: Vec3
  t: number
} | {
  kind: "edge"
  region: number
  edge: number
  point: Vec3
  t: number
} | {
  kind: "none"
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z
  }
}

function add(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z
  }
}

function scale(a: Vec3, s: number): Vec3 {
  return {
    x: a.x * s,
    y: a.y * s,
    z: a.z * s
  }
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

function normalize(a: Vec3): Vec3 {
  const l = Math.hypot(a.x, a.y, a.z) || 1
  return {
    x: a.x / l,
    y: a.y / l,
    z: a.z / l
  }
}

export function screenRay(cam: Camera3D, sx: number, sy: number, width: number, height: number): Ray {
  const eye = cameraEye(cam)
  const target = cam.mode === "fly"
    ? {
        x: eye.x + Math.sin(cam.flyYaw) * Math.cos(cam.flyPitch),
        y: eye.y + Math.cos(cam.flyYaw) * Math.cos(cam.flyPitch),
        z: eye.z + Math.sin(cam.flyPitch),
      }
    : cam.target

  const forward = normalize(sub(target, eye))
  const worldUp = {
    x: 0,
    y: 0,
    z: 1
  }
  let right = cross(forward, worldUp)
  if (Math.hypot(right.x, right.y, right.z) < 1e-6) {
    right = {
      x: 1,
      y: 0,
      z: 0
    }
  } else {
    right = normalize(right)
  }
  const up = normalize(cross(right, forward))
  const aspect = width / Math.max(1, height)
  const tanHalf = Math.tan(cam.fov / 2)
  const nx = ((sx / width) * 2 - 1) * aspect * tanHalf
  const ny = (1 - (sy / height) * 2) * tanHalf
  const dir = normalize(add(add(forward, scale(right, nx)), scale(up, ny)))
  return { origin: eye, dir }
}

function rayTri(ray: Ray, a: Vec3, b: Vec3, c: Vec3): number | null {
  const eps = 1e-6
  const ab = sub(b, a)
  const ac = sub(c, a)
  const pvec = cross(ray.dir, ac)
  const det = dot(ab, pvec)
  if (Math.abs(det) < eps) {
    return null
  }

  const invDet = 1 / det
  const tvec = sub(ray.origin, a)
  const u = dot(tvec, pvec) * invDet
  if (u < 0 || u > 1) {
    return null
  }

  const qvec = cross(tvec, ab)
  const v = dot(ray.dir, qvec) * invDet
  if (v < 0 || u + v > 1) {
    return null
  }

  const t = dot(ac, qvec) * invDet
  return t > eps ? t : null
}

export function raycastTris(ray: Ray, tris: Tri[]): { t: number; tri: Tri; point: Vec3 } | null {
  let best: { t: number; tri: Tri; point: Vec3 } | null = null
  for (const tri of tris) {
    if (tri.kind === "gizmo" || tri.kind === "link" || tri.kind === "helper") {
      continue
    }

    const t = rayTri(ray, tri.a, tri.b, tri.c)
    if (t == null) {
      continue
    }

    if (!best || t < best.t) {
      best = { t, tri, point: add(ray.origin, scale(ray.dir, t)) }
    }
  }
  return best
}

export function raycastLevel(
  ray: Ray,
  level: LevelData,
  tris: Tri[],
  opts?: { preferVertices?: boolean; gridStep?: number },
): Hit {

  if (opts?.preferVertices) {
    const vertHit = pickVertexAlongRay(ray, level, 6)
    if (vertHit) {
      return vertHit
    }
  }

  const hit = raycastTris(ray, tris)
  if (!hit) {
    const t = rayPlaneZ(ray, 4)
    if (t != null) {
      const p = add(ray.origin, scale(ray.dir, t))
      const ri = findRegion(level, p.x, p.y)
      if (ri >= 0) {
        return {
          kind: "region",
          index: ri,
          point: p,
          t,
          face: "floor"
        }
      }
    }
    return {
      kind: "none"
    }
  }

  const { tri, point, t } = hit
  if (tri.kind === "object" && tri.object != null) {
    return {
      kind: "object",
      index: tri.object,
      point,
      t
    }
  }

  if (tri.kind === "player") {
    return {
      kind: "player",
      point,
      t
    }
  }

  if (tri.region != null) {
    const face = tri.kind === "ceil" ? "ceil" : tri.kind === "wall" ? "wall" : "floor"
    return {
      kind: "region",
      index: tri.region,
      point,
      t,
      face
    }
  }

  if (tri.kind === "wall") {
    const ri = findRegion(level, point.x, point.y)
    if (ri >= 0) {
      return {
        kind: "region",
        index: ri,
        point,
        t,
        face: "wall"
      }
    }
  }

  return { kind: "none" }
}

function rayPlaneZ(ray: Ray, z: number): number | null {
  if (Math.abs(ray.dir.z) < 1e-8) {
    return null
  }

  const t = (z - ray.origin.z) / ray.dir.z
  return t > 0 ? t : null
}

export function rayFloorIntersection(ray: Ray, floorZ: number): Vec3 | null {
  const t = rayPlaneZ(ray, floorZ)
  if (t == null) {
    return null
  }

  return add(ray.origin, scale(ray.dir, t))
}

function findRegion(level: LevelData, x: number, y: number): number {
  for (let i = level.regions.length - 1; i >= 0; i--) {
    if (pointInPolygon(x, y, level.regions[i].vertices)) {
      return i
    }
  }

  return -1
}

function pickVertexAlongRay(ray: Ray, level: LevelData, threshold: number): Hit | null {
  let best: Hit | null = null
  let bestDist = threshold
  level.regions.forEach((region, ri) => {
    region.vertices.forEach(([x, y], vi) => {
      const p = { x, y, z: region.floor }
      const to = sub(p, ray.origin)
      const t = dot(to, ray.dir)
      if (t < 0) {
        return
      }

      const closest = add(ray.origin, scale(ray.dir, t))
      const d = Math.hypot(closest.x - p.x, closest.y - p.y, closest.z - p.z)
      if (d < bestDist) {
        bestDist = d
        best = {
          kind: "vertex",
          region: ri,
          vertex: vi,
          point: p,
          t
        }
      }
    })
  })
  return best
}

export function nearestEdgeAlongRay(ray: Ray, level: LevelData, regionIndex: number, threshold = 8): Hit | null {
  const region = level.regions[regionIndex]
  if (!region) {
    return null
  }

  let best: Hit | null = null
  let bestDist = threshold
  const n = region.vertices.length
  for (let i = 0; i < n; i++) {
    const [ax, ay] = region.vertices[i]
    const [bx, by] = region.vertices[(i + 1) % n]
    const a = {
      x: ax,
      y: ay,
      z: region.floor
    }
    const b = {
      x: bx,
      y: by,
      z: region.floor
    }
    const mid = {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      z: region.floor
    }
    const to = sub(mid, ray.origin)
    const t = dot(to, ray.dir)
    if (t < 0) {
      continue
    }

    const closest = add(ray.origin, scale(ray.dir, t))
    const d = Math.hypot(closest.x - mid.x, closest.y - mid.y, closest.z - mid.z)
    if (d < bestDist) {
      bestDist = d
      best = {
        kind: "edge",
        region: regionIndex,
        edge: i,
        point: mid, t
      }
    }
  }
  return best
}

export function snapVec(p: Vec3, gridStep: number): Vec3 {
  const s = (n: number) => Math.round(n / gridStep) * gridStep
  return {
    x: s(p.x),
    y: s(p.y),
    z: s(p.z)
  }
}
