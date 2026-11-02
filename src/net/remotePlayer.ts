import { matrixRotateXy } from "../math/matrix"
import { newVector, newVectorFromList, type Vector } from "../math/vector"
import { mergeSprites, Sprite } from "../mesh/sprite"
import { makeCube } from "../entities/meshes"
import type { GameObject } from "../entities/types"
import { ctx } from "../state"
import { clamp } from "../math/helpers"

const BODY = [0.15, 0.75, 0.72]
const DARK = [0.08, 0.28, 0.3]
const ACCENT = [0.35, 1.1, 1.0]
const LERP = 0.22

export class RemotePlayer implements GameObject {
  id: string
  position: Vector
  theta = 0
  pitch = 0
  health = 5
  jumping = false
  firing = false
  dead = false
  private displayPos: Vector
  private displayYaw = 0
  private targetPos: Vector
  private targetYaw = 0
  private root: Sprite
  private lastSeen = performance.now()
  private firePulse = 0

  constructor(id: string, position: Vector) {
    this.id = id
    this.position = position
    this.displayPos = position
    this.targetPos = position
    const part = (size: number[], pos: number[], color: number[]) =>
      new Sprite(makeCube(newVectorFromList(size)), newVectorFromList(pos), null, false, color)

    this.root = mergeSprites([
      part([3.6, 2.2, 4.2], [0, 0.1, 1.2], BODY),
      part([3.2, 1.8, 1.4], [0, 0, -1.5], DARK),
      part([2.6, 2.8, 2.4], [0, 0.2, 5.8], DARK),
      part([2.0, 0.4, 1.1], [0, -2.2, 5.6], ACCENT),
      part([1.1, 1.1, 3.2], [3.1, 0, 0.8], BODY),
      part([1.1, 1.1, 3.2], [-3.1, 0, 0.8], BODY),
      part([1.4, 1.6, 3.6], [1.4, 0.1, -4.2], DARK),
      part([1.4, 1.6, 3.6], [-1.4, 0.1, -4.2], DARK),
    ])
  }

  applyPose(
    x: number,
    y: number,
    z: number,
    yaw: number,
    pitch: number,
    jump = false,
    fire = false,
    health = this.health,
  ): void {
    this.targetPos = newVector(x, y, z)
    this.targetYaw = yaw
    this.pitch = pitch
    this.jumping = jump
    this.firing = fire
    this.health = health
    this.lastSeen = performance.now()
    if (fire) {
      this.firePulse = 1
    }
  }

  get stale(): boolean {
    return performance.now() - this.lastSeen > 4000
  }

  update(dt = 16): void {
    if (this.dead) {
      return
    }

    const t = clamp(LERP * (dt / 16), 0.05, 0.5)
    this.displayPos = this.displayPos.lerp(this.targetPos, t)
    let dyaw = this.targetYaw - this.displayYaw
    while (dyaw > Math.PI) dyaw -= Math.PI * 2
    while (dyaw < -Math.PI) dyaw += Math.PI * 2
    this.displayYaw += dyaw * t
    this.position = this.displayPos
    this.theta = this.displayYaw
    this.firePulse = Math.max(0, this.firePulse - dt / 120)
    const bob = this.jumping ? 1.2 : Math.sin(performance.now() / 180) * 0.15
    this.root.position = this.displayPos.add(newVector(0, 0, bob))
    this.root.rotation = matrixRotateXy(-this.displayYaw)
  }

  render(): void {
    if (this.dead) {
      return
    }

    this.root.render()
  }
}

const remotes = new Map<string, RemotePlayer>()

export function upsertRemotePlayer(
  id: string,
  x: number,
  y: number,
  z: number,
  yaw: number,
  pitch: number,
  jump = false,
  fire = false,
  health = 5,
): void {
  if (!ctx.gl || !ctx.objects) {
    return
  }

  let remote = remotes.get(id)
  if (!remote) {
    remote = new RemotePlayer(id, newVector(x, y, z))
    remotes.set(id, remote)
    ctx.objects.push(remote)
  } else if (!ctx.objects.includes(remote)) {
    remote.dead = false
    ctx.objects.push(remote)
  }

  remote.applyPose(x, y, z, yaw, pitch, jump, fire, health)
}

export function markRemoteDead(id: string): void {
  const remote = remotes.get(id)
  if (!remote) {
    return
  }

  remote.dead = true
}

export function markRemoteAlive(id: string, x: number, y: number, z: number, health: number): void {
  const remote = remotes.get(id)
  if (!remote) {
    upsertRemotePlayer(id, x, y, z, 0, 0, false, false, health)
    return
  }
  
  remote.dead = false
  remote.health = health
  remote.applyPose(x, y, z, remote.theta, remote.pitch, false, false, health)
  if (!ctx.objects.includes(remote)) {
    ctx.objects.push(remote)
  }
}

export function removeRemotePlayer(id: string): void {
  const remote = remotes.get(id)
  if (!remote) {
    return
  }
  remote.dead = true
  remotes.delete(id)
}

export function clearRemotePlayers(): void {
  for (const remote of remotes.values()) {
    remote.dead = true
  }
  remotes.clear()
}

export function pruneStaleRemotes(): void {
  for (const [id, remote] of remotes) {
    if (remote.stale) {
      remote.dead = true
      remotes.delete(id)
    }
  }
}

export function getRemotePlayer(id: string): RemotePlayer | undefined {
  return remotes.get(id)
}

export function remoteCount(): number {
  return remotes.size
}
