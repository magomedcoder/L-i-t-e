import { play } from "../audio/audio"
import { detectCollisionPositions, Flash, Hit, LightFlash, Shell } from "../entities"
import { Flashlight, Goal, RealDoor } from "../entities/collectables"
import { Health } from "../entities/pickup"
import { getGameHooks } from "../game/hooks"
import { range } from "../math/helpers"
import { newVector } from "../math/vector"
import { ctx } from "../state"
import { clearGuestCollectRequests, mpBroadcastCollect, mpIsHost } from "./authority"
import { getRemotePlayer, markRemoteAlive, markRemoteDead } from "./remotePlayer"
import type { CollectKind, CollectMsg, LevelMsg, ShootMsg } from "./types"

export function applyRemoteShoot(msg: ShootMsg): void {
  if (!ctx.gl || !ctx.objects) {
    return
  }

  const origin = newVector(msg.ox, msg.oy, msg.oz)
  const forward = newVector(msg.fx, msg.fy, msg.fz)
  const hits = detectCollisionPositions(origin, origin.add(forward.scalarMultiply(1e4)), true)
  let distanceToHit = 100
  if (hits.length > 0) {
    const hit = hits[0]
    distanceToHit = hit[0].distanceTo(origin)
    ctx.objects.push(new LightFlash(hit[0].lerp(origin, 0.2), 3))
    range(20).forEach(() => ctx.objects.push(new Hit(hit[0], 2)))
    hit[1].onhit?.()
  }

  play(ctx.sounds.gun)
  ctx.objects.push(new Flash(origin, forward, distanceToHit))
  ctx.objects.push(new Shell(origin, newVector(-forward.y, forward.x, 0)))
}

export function applyRemoteHurt(id: string, health: number): void {
  const remote = getRemotePlayer(id)
  if (remote) {
    remote.health = health
  }
}

export function applyRemoteDeath(id: string): void {
  markRemoteDead(id)
}

export function applyRemoteRespawn(id: string, x: number, y: number, z: number, health: number): void {
  markRemoteAlive(id, x, y, z, health)
}

function near(obj: { position: { x: number; y: number; z: number } }, x: number, y: number, z: number): boolean {
  return Math.hypot(obj.position.x - x, obj.position.y - y, obj.position.z - z) < 28
}

function findCollectable(kind: CollectKind, uid: number, x: number, y: number, z: number) {
  for (const obj of ctx.objects) {
    if (kind === "goal" && obj instanceof Goal && !obj.dead && obj.uid === uid && near(obj, x, y, z)) {
      return obj
    }

    if (kind === "health" && obj instanceof Health && !obj.dead && near(obj, x, y, z)) {
      return obj
    }

    if (kind === "flashlight" && obj instanceof Flashlight && !obj.dead && near(obj, x, y, z)) {
      return obj
    }

    if (kind === "exit" && obj instanceof RealDoor && !obj.dead && near(obj, x, y, z)) {
      return obj
    }
  }

  if (kind === "goal") {
    return ctx.objects.find((o) => o instanceof Goal && !o.dead && o.uid === uid) as Goal | undefined
  }

  return null
}

export function hostHandleCollectReq(kind: CollectKind, uid: number, x: number, y: number, z: number): void {
  if (!mpIsHost()) {
    return
  }

  const obj = findCollectable(kind, uid, x, y, z)
  if (!obj || obj.dead) {
    return
  }

  forceCollect(obj, kind)
  mpBroadcastCollect(kind, uid, obj.position.x, obj.position.y, obj.position.z)
}

export function applyNetworkCollect(msg: CollectMsg): void {
  const obj = findCollectable(msg.kind, msg.uid, msg.x, msg.y, msg.z)
  if (!obj || obj.dead) {
    return
  }

  if (msg.kind === "health") {
    forceCollect(obj, "health")
    return
  }
  
  if (mpIsHost()) {
    return
  }

  forceCollect(obj, msg.kind)
}

function forceCollect(obj: Goal | Health | Flashlight | RealDoor, kind: CollectKind): void {
  obj.__mpForce = true
  if (kind === "health") {
    play(ctx.sounds.collect)
    obj.dead = true
  } else {
    obj.collect()
    obj.dead = true
  }
  delete obj.__mpForce
}

export function applyNetworkLevel(msg: LevelMsg): void {
  if (mpIsHost()) {
    return
  }

  const hooks = getGameHooks()
  if (msg.action === "next") {
    ctx.keys = {}
    setTimeout(() => {
      clearGuestCollectRequests()
      hooks.setResolution(-1)
      hooks.reset()
      ctx.map.levels.shift()
      ctx.map.loadLevel()
    }, 200)
    return
  }
  
  if (msg.action === "reset") {
    setTimeout(() => {
      hooks.setResolution(-1)
      ctx.health = 5
      hooks.reset()
      if (ctx.difficulty) {
        ctx.map.levels = [...ctx.map.allLevels]
      }
      ctx.map.loadLevel()
    }, 100)
    return
  }

}

