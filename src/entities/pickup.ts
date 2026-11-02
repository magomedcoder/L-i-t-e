import { lathe } from "../mesh/lathe"
import { IDENTITY } from "../math/matrix"
import { Z_DIR } from "../math/vector"
import type { Vector } from "../math/vector"
import { Sprite } from "../mesh/sprite"
import { play } from "../audio/audio"
import { ctx } from "../state"
import type { GameObject } from "./types"
import { fadeTo, updateHealth } from "./hud"
import { guestCollectKey, mpActive, mpBlocksLocalCollect, mpBroadcastCollect, mpIsHost, mpRequestCollect, tryMarkGuestCollect } from "../net/authority"
import type { CollectKind } from "../net/types"

export class Collectable implements GameObject {
  sprite: Sprite | Sprite[]
  position: Vector
  dead?: boolean
  time = 0
  collect_dist = 10
  __mpForce?: boolean
  protected mpKind: CollectKind | null = null
  protected mpUid = 0

  constructor(position: Vector, sprite: Sprite | Sprite[]) {
    this.sprite = sprite
    this.position = position.add(Z_DIR.scalarMultiply(2))
    if (!Array.isArray(sprite)) {
      sprite.position = this.position.copy()
    }
  }

  collect(): void {
    play(ctx.sounds.collect)
    setTimeout(() => play(ctx.sounds.collect2), 150)
  }

  update(_dt: number): void {
    if (this.dead) {
      return
    }

    if (this.position.noz().distanceTo(ctx.camera.position.noz()) < this.collect_dist * (1 + Number(ctx.goingBack) / 2)) {
      if (this.mpKind && mpBlocksLocalCollect() && !this.__mpForce) {
        const key = guestCollectKey(this.mpKind, this.mpUid, this.position.x, this.position.y)
        if (tryMarkGuestCollect(key)) {
          mpRequestCollect(this.mpKind, this.mpUid, this.position.x, this.position.y, this.position.z)
        }
        return
      }

      this.collect()
      this.dead = true
      if (this.mpKind && mpIsHost() && !this.__mpForce) {
        mpBroadcastCollect(this.mpKind, this.mpUid, this.position.x, this.position.y, this.position.z)
      }
    }
  }

  render(): void {
    if (!Array.isArray(this.sprite)) this.sprite.render()
  }
}

export class Health extends Collectable {
  constructor(position: Vector) {
    const mesh = lathe(
      [0.5, -0.5, 0.6, 0.5, 0.3, 0.5, 0.3, 0.8, 0, 0.5, -0.2, 0.3, -0.3, 0.3, -0.4, 0.3, -0.3, 0.3, -0.1, 0.3, 0, 0.5, -0.2, 0.8],
      16,
      0,
      true,
    )
    super(position, new Sprite(mesh, null as unknown as Vector, IDENTITY, false, [0.15, 0.85, 1.1]))
    this.mpKind = "health"
  }

  collect(): void {
    super.collect()
    updateHealth(1)
    fadeTo([0, 0, 1, 0.5])
  }

  update(_dt: number): void {
    if (this.dead) {
      return
    }
    
    if (this.__mpForce) {
      this.dead = true
      return
    }

    if (this.position.noz().distanceTo(ctx.camera.position.noz()) < this.collect_dist * (1 + Number(ctx.goingBack) / 2)) {
      this.collect()
      this.dead = true
      if (mpActive()) {
        mpBroadcastCollect("health", 0, this.position.x, this.position.y, this.position.z)
      }
    }
  }
}
