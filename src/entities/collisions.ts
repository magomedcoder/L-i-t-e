import { rayLineIntersect, type Vector } from "../math/vector"
import { ctx } from "../state"
import type { CollisionHit, GameObject } from "./types"
import { LockedDoor, Wall } from "./hitbox"

export function detectCollisionPositions(pos: Vector, them: Vector, doFloors?: boolean, onlyWalls?: boolean): CollisionHit[] {
  const delta = them.subtract(pos).noz()
  const len = delta.vectorLength()
  const candidates = onlyWalls ? ctx.walls : ctx.objects
  const hits: CollisionHit[] = []

  for (let i = 0; i < candidates.length; i++) {
    const x = candidates[i]
    if (!x.solid) {
      continue
    }

    if (onlyWalls && !(x instanceof Wall)) {
      continue
    }

    const dx = x.position!.x - pos.x
    const dy = x.position!.y - pos.y
    if (len + x._width! * 2 < Math.sqrt(dx * dx + dy * dy)) {
      continue
    }

    const distToAndAlong = rayLineIntersect(
      pos,
      delta,
      x.position!.add(x.parallel_dir!),
      x.position!.subtract(x.parallel_dir!),
    )
    if (!distToAndAlong || distToAndAlong[0] > 1) {
      continue
    }

    const at = pos.lerp(them, distToAndAlong[0])
    if (at.z <= x.position!.z || at.z >= x.position!.z + x._height!) {
      continue
    }

    if (doFloors && x instanceof LockedDoor && x.uid != Math.PI / 2 && distToAndAlong[1] % 0.05 >= 0.02) {
      continue
    }

    hits.push([at, x])
  }

  if (doFloors) {
    for (const region of ctx.map.regions) {
      let hitPos: Vector | undefined
      if (them.z < region.ceilHeight) {
        hitPos = pos.lerp(them, (region.floorHeight - pos.z) / (them.z - pos.z))
      }

      if (region.ceilHeight < them.z) {
        hitPos = pos.lerp(them, (region.ceilHeight - pos.z) / (them.z - pos.z))
      }

      if (hitPos && ctx.map.getRegionAt(hitPos) == region) {
        hits.push([hitPos, {} as GameObject])
      }
    }
  }

  hits.sort((a, b) => a[0].distanceTo(pos) - b[0].distanceTo(pos))
  return hits
}
