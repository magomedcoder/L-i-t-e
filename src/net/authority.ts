import { mpSession } from "./session"
import type { CollectKind } from "./types"

const pendingGuestCollect = new Set<string>()

export function guestCollectKey(kind: CollectKind, uid: number, x: number, y: number): string {
  return `${kind}:${uid}:${x | 0}:${y | 0}`
}

export function tryMarkGuestCollect(key: string): boolean {
  if (pendingGuestCollect.has(key)) {
    return false
  }
  pendingGuestCollect.add(key)

  return true
}

export function clearGuestCollectRequests(): void {
  pendingGuestCollect.clear()
}

export function mpActive(): boolean {
  return mpSession.ready
}

export function mpIsHost(): boolean {
  return mpSession.snapshot.role === "host"
}

export function mpIsGuest(): boolean {
  return mpSession.snapshot.role === "guest"
}

export function mpBlocksLocalCollect(): boolean {
  return mpActive() && mpIsGuest()
}

export function mpBroadcastCollect(kind: CollectKind, uid: number, x: number, y: number, z: number): void {
  if (!mpActive()) {
    return
  }

  if (kind !== "health" && !mpIsHost()) {
    return
  }
  
  mpSession.send({ type: "collect", kind, uid, x, y, z })
}

export function mpRequestCollect(kind: CollectKind, uid: number, x: number, y: number, z: number): void {
  if (!mpActive() || !mpIsGuest()) {
    return
  }
  mpSession.send({ type: "collect-req", kind, uid, x, y, z })
}

export function mpBroadcastLevel(action: "next" | "reset" | "end"): void {
  if (!mpActive() || !mpIsHost()) {
    return
  }
  
  mpSession.send({ type: "level", action })
}

export function mpSendHurt(health: number): void {
  if (!mpActive()) {
    return
  }

  mpSession.send({ type: "hurt", id: mpSession.snapshot.peerId, health })
}

export function mpSendDeath(): void {
  if (!mpActive()) {
    return
  }

  mpSession.send({ type: "death", id: mpSession.snapshot.peerId })
}

export function mpSendRespawn(x: number, y: number, z: number, health: number): void {
  if (!mpActive()) {
    return
  }

  mpSession.send({ type: "respawn", id: mpSession.snapshot.peerId, x, y, z, health })
}

export function mpSendShoot(ox: number, oy: number, oz: number, fx: number, fy: number, fz: number): void {
  if (!mpActive()) {
    return
  }

  mpSession.send({ type: "shoot", id: mpSession.snapshot.peerId, ox, oy, oz, fx, fy, fz })
}
