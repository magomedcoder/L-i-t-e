import { lathe } from "../mesh/lathe"
import { IDENTITY, matrixRotateXy, matrixRotateYz, matVectorProduct, multiply } from "../math/matrix"
import { newVector, type Vector, Z_DIR } from "../math/vector"
import { mergeSprites, Sprite } from "../mesh/sprite"
import { play } from "../audio/audio"
import { healthBar, hudRoot } from "../dom"
import { ctx } from "../state"
import { getGameHooks } from "../game/hooks"
import { LockedDoor } from "./hitbox"
import { makeCube, makeCylinder, pallet, sphere } from "./meshes"
import { appendTitleLines, fadeTo, setTitleLines } from "./hud"
import { t } from "../i18n"
import { Collectable } from "./pickup"
import { isEnemyType } from "../map/levelFormat"

export { Collectable, Health } from "./pickup"

export class Flashlight extends Collectable {
  declare sprite: Sprite[]

  constructor(position: Vector, theta: number) {
    position = position.add(newVector(4, 0, 0))
    const mesh = lathe([0.9, 0, 0.1, 0.1, 0, 4, 0.5, 1, 0, 1, -0.1, 0, -0.4, -1], 32, 0, true)
    const rot = multiply(matrixRotateXy(-theta), matrixRotateYz(-1.4))
    const sprites = [
      new Sprite(mesh, null as unknown as Vector, rot, false, [0.15, 0.18, 0.22]),
      new Sprite(sphere(2), null as unknown as Vector, 0, 1, [1.2, 4.5, 5]),
    ]

    super(position, sprites)
    this.collect_dist = 15
    this.sprite = sprites
    sprites[0].position = this.position
    sprites[1].position = this.position.add(matVectorProduct(rot, Z_DIR.scalarMultiply(5.8)))
    ctx.lights[0].position = position.add(matVectorProduct(rot, Z_DIR.scalarMultiply(8)))
    ctx.lights[0].shadow_camera.theta = theta
  }

  collect(): void {
    super.collect()
    fadeTo([0.4, 0.4, 0.4, 1])
    ctx.lightIsHeld = true
  }

  render(): void {
    this.sprite.forEach((x) => x.render())
  }
}

export class Goal extends Collectable {
  uid: number
  declare sprite: Sprite

  constructor(position: Vector, pairId: number, rotation?: number) {
    const rot = rotation ?? pairId
    const color = pallet[(pairId * 8) / Math.PI]
    let sprite: Sprite
    if (pairId == Math.PI / 2) {
      sprite = new Sprite(
        lathe([0, 0, 2, 2, 0, 0.1, -1, 0.6], 8, 0, true),
        position,
        IDENTITY,
        true,
        color,
      )
    } else {
      sprite = mergeSprites([
        new Sprite(
          lathe([1.3, 0, 0.8, 0, 0, 0.8, -0.8, 0, 0, -0.8], 16, 0, false),
          newVector(-3, 0, 0),
          matrixRotateYz(Math.PI / 2),
          true,
          color,
        ),
        new Sprite(makeCylinder(newVector(0.6, 0.6, 9)), newVector(-1, 0, 0), null, false, color),
        new Sprite(makeCube(newVector(2, 1, 1.5)), newVector(6, 0, -1.5), null, false, color),
        new Sprite(makeCube(newVector(0.6, 1, 0.5)), newVector(5.25, 0, -2), null, false, color),
        new Sprite(makeCube(newVector(0.6, 1, 0.5)), newVector(6.75, 0, -2), null, false, color),
      ])
    }
    sprite.rotation = matrixRotateXy(rot)
    position.z += 6 * +(ctx.map.levels.length == 1 && !color[4])
    super(position, sprite)
    this.collect_dist = 15
    this.uid = pairId
  }

  update(dt: number): void {
    super.update(dt)
    this.sprite.rotation = multiply(matrixRotateXy(dt / 400), this.sprite.rotation)
    this.sprite.position.z = this.position.z + Math.sin((this.time += dt / 300)) * 4 + 4
  }

  collect(): void {
    const exitdoors = ctx.objects.filter((x) => x instanceof LockedDoor && this.uid == x.uid) as LockedDoor[]
    exitdoors[0].parent_obj!.dead = true

    if (this.uid == Math.PI / 2) {
      play(ctx.sounds.clock)
      fadeTo([1, 1, 1, 1])
      ctx.objects.push(new RealDoor(exitdoors[0].position.subtract(newVector(0, 40, -10))))
      ctx.map.spawnObjects(
        ctx.map.remake.filter((obj) => isEnemyType(obj.type)),
        ctx.objects,
      )
      ctx.objects.forEach((x) => {
        x.attacking = 1
      })
      ctx.goingBack = true
      ctx.musicTimeouts.forEach(clearTimeout)
      ctx.musicTimeouts = []
    } else {
      super.collect()
      fadeTo([0, 0.5, 0, 0.5])
    }
  }
}

export class RealDoor extends Collectable {
  count = 0
  shadowReady = false

  constructor(position: Vector) {
    super(
      position.subtract(Z_DIR.scalarMultiply(20)),
      new Sprite(
        makeCube(newVector(1, 40, 40)),
        position,
        matrixRotateXy(Math.PI / 2),
        1,
        [10, 10, 10],
      ),
    )
    ctx.lights[2].position = position.add(newVector(0, -20, 0))
    ctx.lights[2].shadow_camera.theta = 0
    ctx.lights[2].shadow = true
  }

  update(dt: number): void {
    super.update(dt)
    if ((this.count += dt) > 200 && !this.shadowReady) {
      this.shadowReady = true
      const orig = ctx.objects
      ctx.objects = ctx.objects.filter((x) => x.isWall)
      ctx.lights[2].compute_shadowmap()
      ctx.objects = orig
    }
  }

  collect(): void {
    fadeTo([1, 1, 1, 1])
    const hooks = getGameHooks()
    if (ctx.map.levels.length > 1) {
      ctx.keys = {}
      setTimeout(() => {
        hooks.setResolution(-1)
        hooks.reset()
        ctx.map.levels.shift()
        ctx.map.loadLevel()
      }, 200)
    } else {
      healthBar.style.display = "none"
      hudRoot.style.top = "50%"
      hudRoot.style.left = "50%"
      hudRoot.style.transform = "translate(-50%, -50%)"
      setTimeout(() => {
        ctx.endScreen = true
        document.exitPointerLock()
        ctx.globalScreenColor = [1, 1, 1, 0]
        cancelAnimationFrame(ctx.frame)
        setTitleLines([
          t("goal.time", {
            minutes: (ctx.lastNow / 60000) | 0,
            seconds: ((ctx.lastNow / 1000) % 60) | 0,
          }),
          "",
        ])
        if (ctx.difficulty) {
          setTimeout(() => appendTitleLines([t("goal.congrats"), "", t("goal.reload")]), 2000)
          ctx.difficulty = 1
        } else {
          setTimeout(() => appendTitleLines([t("goal.hardMode")]), 2000)
          ctx.difficulty = 1
          setTimeout(() => {
            ctx.globalScreenColor = [0, 0, 0, 1]
            ctx.endScreen = false
            ctx.health = 5
            hooks.reset()
            ctx.map.levels = [...ctx.map.allLevels]
            ctx.map.loadLevel()
            requestAnimationFrame(hooks.gameStep)
          }, 5000)
        }
      }, 200)
    }
  }
}
