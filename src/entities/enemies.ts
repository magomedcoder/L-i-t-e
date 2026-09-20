import { range, urandom } from "../math/helpers"
import { type Mat4, matrixRotateXy, matrixRotateXz, matrixRotateYz, matVectorProduct, multiply } from "../math/matrix"
import { angleBetween, newVector, newVectorFromList, urandomVector, type Vector, Z_DIR } from "../math/vector"
import { mergeSprites, Sprite } from "../mesh/sprite"
import { play } from "../audio/audio"
import { ctx } from "../state"
import type { FloorCache, GameObject } from "./types"
import { HitBox } from "./hitbox"
import { detectCollisionPositions } from "./collisions"
import { BodyPart, EnemyBullet, Hit, userHit } from "./physics"
import { makeCube, makeCubeFn } from "./meshes"
import { Health } from "./pickup"

export let killed_enemies = 0

export class BaseEnemy implements GameObject {
  position: Vector
  theta: number
  floor_cache: FloorCache = {}
  state = 0
  timer = 0
  _height: number
  patrol?: Vector[]
  waypoint: Vector
  attacking: number | boolean = 0
  time: number
  spin_rate = 0.1
  speedinv = 50
  grounded = 0
  dead?: boolean
  components!: Sprite[]
  sprites!: Sprite[]

  constructor(position: Vector, theta: number | undefined, height: number, size: number) {
    this.position = position.add(Z_DIR.scalarMultiply(5))
    this.theta = theta || 0
    this._height = height
    ctx.objects.push(new HitBox(this, 0, size, size * 2, -height))
    ctx.objects.push(new HitBox(this, Math.PI / 2, size, size * 2, -height))
    this.waypoint = position
    this.time = urandom() * 100
  }

  gethelp(): void {
    ctx.objects.forEach((x) => {
      if (x instanceof BaseEnemy) {
        if (x.position.distanceTo(this.position) < 100 && !detectCollisionPositions(x.position, this.position, false, true).length) {
          x.attacking = x.state = 1
        }
      }
    })
  }

  onhit(other?: unknown): void {
    if (other) {
      return
    }

    this.dead = true
    if (killed_enemies++ % (5 + ctx.difficulty * 2) == 0) {
      ctx.objects.push(
        new Health(
          this.position.noz().add(Z_DIR.scalarMultiply(ctx.map.getFloorHeight(this.position, this.floor_cache))),
        ),
      )
    }
    range(30).forEach(() => ctx.objects.push(new Hit(this.position, 4)))
    this.gethelp()
    play(ctx.sounds.boom)
    this.components.forEach((x) => {
      ctx.objects.push(
        new BodyPart(
          x,
          this.position.add(x.position),
          matVectorProduct(
            matrixRotateXy(-ctx.camera.theta),
            newVector(urandom(), 3 + urandom(), 1 + Math.random()),
          ),
        ),
      )
    })
  }

  update(dt: number): void {
    this.patrol = this.patrol || [
      detectCollisionPositions(
        this.position,
        this.position.add(matVectorProduct(matrixRotateXy(this.theta), newVector(1e5, 0, 0))),
        false,
        true,
      )[0][0].subtract(matVectorProduct(matrixRotateXy(this.theta), newVector(5, 0, 0))),
      this.position,
    ]

    const angle_to_me = -angleBetween(this.position, ctx.camera.position)
    const r = Math.random() < 1 / dt

    if (r && !this.attacking && (Math.abs(angle_to_me - this.theta - Math.PI / 2) < Math.PI / 3 || Math.abs(angle_to_me - this.theta - Math.PI / 2) > 2 * Math.PI - Math.PI / 3) && !detectCollisionPositions(ctx.camera.position, this.position, false, true).length) {
      this.gethelp()
      this.attacking = this.state = 1
    }

    if (this.state == 0) {
      const next_pos = this.position.add(
        newVector(
          (Math.cos(this.theta) * dt) / this.speedinv,
          (Math.sin(this.theta) * dt) / this.speedinv,
          0,
        ),
      )
      const next_height = ctx.map.getFloorHeight(next_pos, this.floor_cache)
      const is_close =
        ctx.camera.position.subtract(this.position).vectorLength() < 10 &&
        next_pos.distanceTo(ctx.camera.position) < this.position.distanceTo(ctx.camera.position)
      if (is_close) {
        userHit(this.position)
      }

      if (detectCollisionPositions(this.position, this.waypoint, false, true).length > 0 || is_close || Math.abs(next_height - this.position.z + this._height) > 5 + this.grounded) {
        this.waypoint = this.position.add(urandomVector().scalarMultiply(20).noz())
        this.theta = Math.PI * urandom()
        this.state += +(Math.random() < 0.1)
        return
      }

      const delta_pos = this.waypoint.subtract(this.position).noz()
      let goal_angle = Math.atan2(delta_pos.y, delta_pos.x)
      while (goal_angle - this.theta > Math.PI) this.theta += Math.PI * 2
      while (this.theta - goal_angle > Math.PI) this.theta -= Math.PI * 2
      this.theta += (goal_angle - this.theta) * this.spin_rate
      this.position = next_pos
      this.position.z = next_height * +(this.grounded < 10) + this._height

      if (delta_pos.vectorLength() < 30 / this.spin_rate / this.speedinv) {
        if (this.attacking) {
          this.state = 1
        } else {
          this.patrol!.unshift((this.waypoint = this.patrol!.pop()!))
        }
      }
    }

    if (this.state == 1) {
      const delta_pos = ctx.camera.position.subtract(this.position).normalize()
      this.waypoint = this.position.add(delta_pos.scalarMultiply(10))
      if (Math.random() < 0.1 && !this.grounded) {
        ctx.objects.push(
          new EnemyBullet(
            this.position.add(Z_DIR.scalarMultiply(5)),
            ctx.camera.position.subtract(this.position.add(Z_DIR.scalarMultiply(8))).normalize().scalarMultiply(2 + ctx.difficulty),
          ),
        )
      } else {
        this.state = 0
      }
    }
  }

  render(camera?: unknown): void

  render(
    inner_multiply: number[],
    outer_divide: number[],
    N: number,
    which_rot: (a: number) => Mat4,
  ): void

  render(
    inner_multiply: number[] | unknown,
    outer_divide?: number[],
    N?: number,
    which_rot?: (a: number) => Mat4,
  ): void {
    if (!Array.isArray(inner_multiply) || !outer_divide || N === undefined || !which_rot) {
      return
    }

    this.sprites.forEach((x, i) => {
      x.rotation = multiply(
        matrixRotateXy(this.theta + Math.PI / 2),
        which_rot(Math.sin(inner_multiply[i] * this.time) / outer_divide[i]),
      )
    })
    this.sprites.forEach((x, i) => {
      x.position = this.position.add(
        Z_DIR.scalarMultiply(Math.cos(this.time * 2) / 3 + +(i > N) * 5),
      )
    })
    this.sprites.forEach((x) => x.render())
  }
}

export class Enemy extends BaseEnemy {
  constructor(position: Vector, theta?: number) {
    super(position, theta, 5, 6)
    const armor = [0.22, 0.24, 0.26]
    const dark = [0.08, 0.09, 0.1]
    const cloth = [0.14, 0.18, 0.14]
    const skin = [0.45, 0.32, 0.22]
    const lens = [4.5, 0.2, 0.15]

    const part = (size: number[], pos: number[], color: number[]) => new Sprite(makeCube(newVectorFromList(size)), newVectorFromList(pos), null, false, color)

    const thighR = part([1.6, 1.8, 4.0], [1.5, 0.15, -4.0], cloth)
    const shinR = part([1.35, 1.5, 3.4], [1.5, 0.1, -7.8], dark)
    const bootR = part([1.7, 2.3, 0.85], [1.5, -0.45, -10.2], dark)
    const thighL = part([1.6, 1.8, 4.0], [-1.5, 0.15, -4.0], cloth)
    const shinL = part([1.35, 1.5, 3.4], [-1.5, 0.1, -7.8], dark)
    const bootL = part([1.7, 2.3, 0.85], [-1.5, -0.45, -10.2], dark)

    const hips = part([3.8, 2.1, 1.5], [0, 0, -1.6], armor)
    const torso = part([4.4, 2.5, 4.6], [0, 0.15, 1.5], armor)
    const vest = part([3.4, 0.4, 3.4], [0, -2.3, 1.6], dark)
    const armR = part([1.2, 1.2, 3.6], [3.4, 0.1, 0.9], cloth)
    const armL = part([1.2, 1.2, 3.6], [-3.4, 0.1, 0.9], cloth)
    const handR = part([1.0, 1.0, 1.3], [3.4, -0.2, -1.9], skin)
    const handL = part([1.0, 1.0, 1.3], [-3.4, -0.2, -1.9], skin)
    const neck = part([1.3, 1.3, 1.1], [0, 0, 4.5], skin)
    const helmet = part([2.9, 3.1, 2.7], [0, 0.2, 6.5], dark)
    const visor = part([2.3, 0.45, 1.35], [0, -2.55, 6.3], lens)
    const crest = part([0.55, 1.3, 1.8], [0, 1.3, 7.7], armor)

    this.components = [thighR, shinR, bootR, thighL, shinL, bootL, hips, torso, vest, armR, armL, handR, handL, neck, helmet, visor, crest]
    this.sprites = [
      mergeSprites([hips, torso, vest, neck, helmet, visor, crest]),
      mergeSprites([thighR, shinR, bootR]),
      mergeSprites([thighL, shinL, bootL]),
      mergeSprites([armR, handR]),
      mergeSprites([armL, handL]),
    ]
  }

  update(dt: number): void {
    super.update(dt)
    if (this.time < 100 && ctx.difficulty) {
      this.time += 100
      ctx.objects.push(new FlyingEnemy(this.position, this.theta))
    }

    this.time += dt / 160
  }

  render(): void {
    super.render([0, 1, -1, 0.4, -0.4], [1, 1, 1, 2.5, 2.5], 2, matrixRotateYz)
  }
}

export class FlyingEnemy extends BaseEnemy {
  height_offset: number

  constructor(position: Vector, theta?: number) {
    super(position.copy(), theta, 8, 6)
    const hull = [0.18, 0.2, 0.22]
    const dark = [0.07, 0.08, 0.09]
    const rotor = [0.55, 0.58, 0.6]
    const light = [5, 0.4, 0.15]

    const part = (size: number[], pos: number[], color: number[], transparent: number | boolean = 0) => new Sprite(makeCube(newVectorFromList(size)), newVectorFromList(pos), 0, transparent, color)

    const bladeA = new Sprite(
      makeCubeFn((x) => x.vectorMultiply(newVector(4.4, 0.12, 0.08))),
      newVector(0, 0, 1.3),
      0,
      0,
      rotor,
    )
    const bladeB = new Sprite(
      makeCubeFn((x) => matVectorProduct(matrixRotateXy(Math.PI / 2), x.vectorMultiply(newVector(4.4, 0.12, 0.08)))),
      newVector(0, 0, 1.3),
      0,
      0,
      rotor,
    )
    const airframe = mergeSprites([
      part([1.7, 4.0, 1.25], [0, 0, 0], hull),
      part([1.2, 1.5, 0.95], [0, -3.4, -0.1], dark),
      part([0.5, 0.5, 0.5], [0, -4.2, -0.35], light, 1),
      part([0.28, 3.0, 0.28], [1.35, 0.1, -1.35], dark),
      part([0.28, 3.0, 0.28], [-1.35, 0.1, -1.35], dark),
      part([0.5, 2.4, 0.5], [0, 3.8, 0.25], hull),
      part([0.22, 0.9, 1.5], [0, 5.2, 0.95], dark),
    ])

    this.components = [bladeA, bladeB, airframe]
    this.sprites = [bladeA, bladeB, airframe]
    this.height_offset = 5 * urandom()
    this.spin_rate = 0.1
    this.speedinv = 20
    this.grounded = 50
  }

  update(dt: number): void {
    super.update(dt)
    if (this.floor_cache.o) {
      this._height += 0.1 * ((this.floor_cache.o.floorHeight + this.floor_cache.o.ceilHeight) / 2 + this.height_offset - this._height)
    }

    const deltaz1 = Math.sin(this.time / 5) * 2 + Math.sin(this.time)
    this.time += (dt * (2 + Math.sin(this.time))) / 200
    const deltaz2 = Math.sin(this.time / 5) * 2 + Math.sin(this.time)
    this.position.z += deltaz2 - deltaz1
    const alpha = 1 - 1.01 ** -ctx.camera.position.subtract(this.position).noz().lengthSquared()
    this.position.z = this.position.z * alpha + (ctx.camera.position.z - 10) * (1 - alpha)
  }

  render(): void {
    super.render([10, -10, 0], [1, 1, 1], 9, matrixRotateXz)
  }
}

export function ManyEnemies(position: Vector, count: number): GameObject {
  range((ctx.difficulty * 5 + 5 + count * Math.PI) | 0).forEach((_, i) => ctx.objects.push(new [Enemy, FlyingEnemy][i % 2](position.add(urandomVector().noz().scalarMultiply(20)), urandom() * 10)))
  return {
    render: () => {}, dead: 1
  }
}
