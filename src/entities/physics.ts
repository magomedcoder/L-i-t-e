import { range, urandom } from "../math/helpers"
import { matrixRotateXy, matrixRotateXz, matrixRotateYz, multiply } from "../math/matrix"
import { newVector, urandomVector, type Vector } from "../math/vector"
import { Sprite } from "../mesh/sprite"
import { play } from "../audio/audio"
import { ctx } from "../state"
import type { FloorCache, GameObject } from "./types"
import { detectCollisionPositions } from "./collisions"
import { enemy_bullet, explosion, shell as shellMesh, sphere } from "./meshes"
import { fadeTo, updateHealth } from "./hud"

export class PhysicsObject implements GameObject {
  sprite: Sprite
  position: Vector
  velocity: Vector
  ghost: boolean
  still?: boolean
  dead?: boolean | number
  dz = 0.003
  slow = 0.999
  floor_cache: FloorCache = {}

  constructor(sprite: Sprite, position: Vector, velocity: Vector, ghost?: boolean) {
    this.sprite = sprite
    this.position = position
    this.velocity = velocity
    this.ghost = !!ghost
  }

  update(dt: number): boolean | void {
    if (this.still) {
      return true
    }
    
    this.velocity.z -= this.dz * dt
    this.velocity = this.velocity.scalarMultiply(this.slow ** dt)
    this.position = this.position.add(this.velocity.scalarMultiply(dt / 16))

    const floor = ctx.map.getFloorHeight(this.position, this.floor_cache) + 0.5
    if (!this.ghost) {
      if (this.position.z < floor) {
        this.still = this.velocity.vectorLength() < 0.1
        this.position.z = floor
        this.velocity.z = -this.velocity.z
        this.velocity = this.velocity.scalarMultiply(0.8)
      }
      const hits = detectCollisionPositions(
        this.position,
        this.position.add(this.velocity.scalarMultiply(2)),
      )
      hits.forEach((x) => {
        this.onhit?.(x[1])
        x[1].onhit?.(this)
        const delta = x[0].subtract(this.position)
        this.velocity.y *= Math.abs(delta.y) > 0.1 ? -1 : 1
        this.velocity.x *= Math.abs(delta.x) > 0.1 ? -1 : 1
        this.position = this.position.lerp(x[0], 1.3)
      })
    } else if (this.position.z < floor) {
      this.die?.()
      this.dead = true
    }
  }

  render(): void {
    this.sprite.position = this.position
    this.sprite.render()
  }

  onhit?(other?: unknown): void

  die?(): void
}

export class BodyPart extends PhysicsObject {
  spins: Vector

  constructor(sprite: Sprite, position: Vector, velocity: Vector) {
    super(sprite, position, velocity)
    this.spins = urandomVector()
  }

  update(dt: number): boolean | void {
    if (super.update(dt)) {
      return
    }

    const speed = dt * this.velocity.vectorLength() * 0.005
    this.sprite.rotation = multiply(
      this.sprite.rotation,
      [
        matrixRotateXy(this.spins.x * speed),
        matrixRotateYz(this.spins.y * speed),
        matrixRotateXz(this.spins.z * speed),
      ].reduce(multiply),
    )
  }
}

export class Flash implements GameObject {
  sprite: Sprite
  dead?: boolean
  c = 0

  constructor(pos: Vector, forward: Vector, _dist: number) {
    this.sprite = new Sprite(
      sphere(5),
      pos.add(newVector(0, 0, -1.5)).add(forward.scalarMultiply(2)),
      0,
      1,
      [10, 10, 10],
    )
  }

  render(): void {
    this.sprite.render()
    this.dead = this.c++ > 2
  }
}

export class LightFlash implements GameObject {
  dead?: boolean
  c: number

  constructor(pos: Vector, c?: number) {
    this.c = c ?? 0
    ctx.lights[3].position = pos.copy()
  }

  render(): void {
    if (!this.c--) {
      ctx.lights[3].position.z = 1e9
      this.dead = true
    }
  }
}

export const hitSpritePool: Sprite[] = []

export class Hit extends PhysicsObject {
  constructor(position: Vector, r: number) {
    const x = Math.random() * 0.8
    const sprite =
      hitSpritePool.pop() ||
      new Sprite(explosion, position.add(urandomVector().scalarMultiply(r)), 0, 1, [
        10 * Math.cos(x),
        10 * Math.sin(x),
        0,
      ])
    super(sprite, position, newVector(urandom() / 2, urandom() / 2, 1.5 + urandom()), true)
    this.dz = 0.01
  }

  die(): void {
    this.sprite.position.z = 1e5
    hitSpritePool.push(this.sprite)
  }
}

export const shellSpritePool: Sprite[] = []

export class Shell extends BodyPart {
  private recycled = false

  constructor(position: Vector, right: Vector) {
    const rotation = multiply(ctx.chaingun.rotation, matrixRotateXz(Math.PI / 2))
    const sprite = shellSpritePool.pop() || new Sprite(shellMesh, position, rotation, 0, [0.4, 0.4, 0.4])
    sprite.position = position
    sprite.rotation = rotation
    super(
      sprite,
      position,
      newVector(urandom(), urandom(), 3.5 + urandom() / 2).subtract(right).scalarMultiply(0.2),
    )
  }

  update(dt: number): boolean | void {
    const result = super.update(dt)
    if ((this.still || this.dead) && !this.recycled) {
      this.recycled = true
      this.dead = true
      shellSpritePool.push(this.sprite)
    }

    return result
  }
}

export class EnemyBullet extends PhysicsObject {
  start: number

  constructor(position: Vector, direction: Vector) {
    position = position.add(direction)
    super(
      new Sprite(
        enemy_bullet,
        position,
        matrixRotateXy(Math.atan2(direction.y, direction.x)),
        1,
        [5, 0, 0],
        [22, 1],
      ),
      position,
      direction,
    )
    this.dz = 0
    this.slow = 1
    this.start = ctx.lastNow
  }

  update(dt: number): void {
    super.update(dt)
    if (this.position.distanceTo(ctx.camera.position) < 5) {
      userHit(this.position)
      this.dead = true
    }
    if (ctx.lastNow - this.start > 10000) {
      this.dead = true
    }
  }

  onhit(): void {
    range(30).forEach(() => ctx.objects.push(new Hit(this.position, 2)))
    this.dead = true
  }
}

export function userHit(where: Vector): void {
  if (ctx.lastNow - ctx.lastUserHit > 450 - ctx.difficulty * 200) {
    play(ctx.sounds.hit)
    ctx.lastUserHit = ctx.lastNow
    ctx.objects.push(new LightFlash(where))
    range(15).forEach(() => ctx.objects.push(new Hit(where, 4)))
    ctx.cameraShake++
    fadeTo([0.3, 0, 0, 0.7])
    updateHealth(-1)
  }
}
