import { matrixRotateXy } from "../math/matrix"
import { newVector, newVectorFromList, type Vector } from "../math/vector"
import { mergeSprites, Sprite } from "../mesh/sprite"
import { makeCube } from "../entities/meshes"
import type { GameObject } from "../entities/types"
import { ctx } from "../state"

const BODY = [0.15, 0.75, 0.72]
const DARK = [0.08, 0.28, 0.3]
const ACCENT = [0.35, 1.1, 1.0]

export class RemotePlayer implements GameObject {
  id: string
  position: Vector
  theta = 0
  pitch = 0
  dead = false
  private root: Sprite
  private lastSeen = performance.now()

  constructor(id: string, position: Vector) {
    this.id = id
    this.position = position
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

  applyPose(x: number, y: number, z: number, yaw: number, pitch: number): void {
    this.position = newVector(x, y, z)
    this.theta = yaw
    this.pitch = pitch
    this.lastSeen = performance.now()
  }

  get stale(): boolean {
    return performance.now() - this.lastSeen > 4000
  }

  update(): void {
    this.root.position = this.position
    this.root.rotation = matrixRotateXy(-this.theta)
  }

  render(): void {
    this.root.render()
  }
}

const remotes = new Map<string, RemotePlayer>()

export function upsertRemotePlayer(id: string, x: number, y: number, z: number, yaw: number, pitch: number): void {
  if (!ctx.gl || !ctx.objects) {
    return
  }

  let remote = remotes.get(id)
  if (!remote) {
    remote = new RemotePlayer(id, newVector(x, y, z))
    remotes.set(id, remote)
    ctx.objects.push(remote)
  } else if (!ctx.objects.includes(remote)) {
    ctx.objects.push(remote)
  }

  remote.applyPose(x, y, z, yaw, pitch)
  remote.update()
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

export function remoteCount(): number {
  return remotes.size
}
