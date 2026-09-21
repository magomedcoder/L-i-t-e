import { clamp, urandom } from "../math/helpers"
import { newVector, reduceMean, X_DIR, Y_DIR, ZERO } from "../math/vector"
import { IDENTITY, matrixRotateXy, matrixRotateYz, matVectorProduct, multiply } from "../math/matrix"
import { mergeSprites } from "../mesh/sprite"
import { canvas, healthBar, hudRoot } from "../dom"
import { ctx } from "../state"
import { Camera, createScreenComposer, setupGraphics } from "../gfx/graphics"
import { setStartGame, setupAudio } from "../audio/audio"
import { clearTitle, fadeTo, setupGame, updateHealth, userHit } from "../entities"
import { setupMap } from "../map/map"
import { setGameHooks } from "./hooks"
import { tryShoot } from "./combat"
import { setupInput } from "./input"
import { clipAgainstWalls, collectMoveDirs, applyVerticalMotion } from "./movement"

export function mainRun(): void {
  setupGraphics()
  setupGame()
  setupAudio()
}

export function mainGo(): void {
  setupInput()
  reset()
  setupMap()
  fadeTo([0, 0, 0, 0])
  gameStep(1)
}

export function reset(): void {
  healthBar.style.display = "block"
  hudRoot.style.top = "8vh"
  hudRoot.style.left = "50%"
  hudRoot.style.transform = "translateX(-50%)"
  clearTitle()

  ctx.camera = new Camera(
    newVector(24, -16, 10 + (ctx.map && ctx.map.levels.length == 3 ? 10 : 0)),
    [ctx.gl.canvas.width, ctx.gl.canvas.height],
    1.22,
    false,
    13,
  )
  ctx.globalScreenColor = [0, 0, 0, 1]
  ctx.playerDead = false
  ctx.lightIsHeld = false
  ctx.goingBack = false
  ctx.jumpVelocity = 0
  ctx.jumpHeld = false
  ctx.lights = []
  ctx.objects = []
  ctx.walls = []
  if (!ctx.difficulty) {
    ctx.health = 5
  }
  updateHealth(0)
  ctx.realCamera = createScreenComposer()
}

function handleDeathAnimation(now: number): void {
  const rate = ((now - (ctx.playerDead as number)) ** 0.8 - (ctx.lastNow - (ctx.playerDead as number)) ** 0.8) / 400
  ctx.globalScreenColor[3] -= 0.01 * +(ctx.globalScreenColor[3] > 0)
  ctx.camera.theta += rate
  ctx.camera.theta3 += rate
  ctx.camera.theta2 -= rate / 3
  ctx.gl.useProgram(ctx.program1)
  ctx.locations = ctx.locations1
  ctx.camera.draw_scene()
  ctx.realCamera(ctx.camera._texture)
  ctx.lastNow = now
}

function maybeLowerGraphics(): void {
  if (ctx.totalBadness * +ctx.pageHasFocus > 30 && ctx.graphics < 2) {
    ctx.totalBadness = 0
    setResolution(1)
    const fake_camera = {
      shadow_camera: ctx.camera,
      _texture: ctx.camera._texture
    };[fake_camera, ...ctx.lights].forEach((light, i) => {
      if ((i == 0 && ctx.camera.dimensions[0] > 400) || (i > 0 && ctx.camera.dimensions[0] > 100)) {
        light.shadow_camera = new Camera(
          light.shadow_camera.position,
          light.shadow_camera.dimensions.map((x) => x / 2),
          light.shadow_camera.fov,
          light.shadow_camera.camera_is_light,
          light.shadow_camera.texture_id,
          light.shadow_camera.theta,
          light.shadow_camera.theta2,
        )
        ;(light as {
          _texture: WebGLTexture
        })._texture = light.shadow_camera._texture
      }
    })
    ctx.camera = fake_camera.shadow_camera
    ctx.realCamera = createScreenComposer()
  }
}

export function gameStep(now: number): void {
  if (ctx.endScreen) {
    return
  }
  ctx.frame = requestAnimationFrame(gameStep)

  const currentPos = ctx.camera.position

  if (ctx.playerDead) {
    handleDeathAnimation(now)
    return
  }

  const dt = Math.min(now - ctx.lastNow, 50)
  const move_dir = collectMoveDirs(dt)
  const screen_forward_dir = multiply(
    matrixRotateXy(-ctx.camera.theta),
    matrixRotateYz(-ctx.camera.theta2),
  )
  const screen_right_pos = matVectorProduct(screen_forward_dir, X_DIR.scalarMultiply(-3))
  const screen_forward_pos = matVectorProduct(screen_forward_dir, Y_DIR)
  const offset = newVector(0.2 + Math.sin(ctx.moved) * 0.2, 1, -0.3 - Math.abs((ctx.moved % Math.PI) - Math.PI / 2) / 20)

  if (ctx.keys._) {
    tryShoot(now, screen_forward_pos, screen_right_pos)
  }

  if (move_dir.length) {
    ctx.camera.position = ctx.camera.position.add(reduceMean(move_dir).scalarMultiply(ctx.speed))
    ctx.moved += dt / 180
  } else {
    ctx.speed -= +(ctx.speed > 0) * (dt / 160)
    ctx.speed *= +(ctx.speed > 0)
    ctx.moved -= ((ctx.moved % Math.PI) - Math.PI * +(ctx.moved % Math.PI > Math.PI / 2)) * (dt / 160)
  }

  if (ctx.camera.position.z < 10 && ctx.map.getFloorHeight(ctx.camera.position) < 0 && ctx.lastNow - ctx.lastUserHit > 500) {
    userHit(newVector(0, 0, -1e9))
  }

  clipAgainstWalls(currentPos)

  applyVerticalMotion(dt)
  const fall_rate = ctx.map.getFloorHeight(ctx.camera.position) + 10 - ctx.camera.position.z
  ctx.cameraShake = clamp(ctx.cameraShake - fall_rate * 0.15 * +(fall_rate < 0) - 0.1, 0, 4)

  if (ctx.lightIsHeld) {
    ctx.lights[0].position = ctx.lights[0].position.lerp(ctx.camera.position.subtract(screen_right_pos), 0.2)
    ctx.lights[0].shadow_camera.theta += (ctx.camera.theta - ctx.lights[0].shadow_camera.theta) / 2
    ctx.lights[0].shadow_camera.theta2 += (ctx.camera.theta2 - ctx.lights[0].shadow_camera.theta2) / 2
    ctx.lights[0].markShadowDirty()
  }

  const camera_theta = ctx.camera.theta
  const camera_theta2 = ctx.camera.theta2
  const camera_z = ctx.camera.position.z
  const light_z = ctx.lights[0].position.z

  ctx.camera.position.z += Math.cos(ctx.moved * 2) * 2 + (ctx.speed - 1) * 4
  if (ctx.lightIsHeld) {
    ctx.lights[0].position.z += Math.cos(ctx.moved * 2) * 2 + (ctx.speed - 1) * 4
  }
  ctx.camera.theta3 = Math.sin(ctx.moved) / 50

  const spinning = ctx.keys._ ? matrixRotateYz(now / 100) : IDENTITY
  ctx.chaingun.position = ctx.camera.position.add(matVectorProduct(screen_forward_dir, offset.add(ctx.chaingun.recoil)).scalarMultiply(8))
  ctx.chaingun.recoil = ctx.chaingun.recoil.lerp(ZERO, 0.1)
  ctx.chaingun.rotation = multiply(multiply(screen_forward_dir, matrixRotateXy(-Math.PI / 2)), spinning)
  ctx.myBody.rotation = matrixRotateXy(-ctx.camera.theta)
  ctx.myBody.position = ctx.camera.position.subtract(
    matVectorProduct(ctx.myBody.rotation, newVector(0, 4 + +ctx.lightIsHeld * 10, 5)),
  )

  const amt = Math.min(ctx.cameraShake, 2) ** 2 / 200
  ctx.camera.theta += urandom() * amt
  ctx.camera.theta2 += urandom() * amt
  ctx.camera.theta3 += urandom() * amt

  ctx.lights.forEach((light) => {
    if (light.dynamic_shadow) {
      light.compute_shadowmap()
    }
  })

  ctx.gl.useProgram(ctx.program1)
  ctx.locations = ctx.locations1
  ctx.camera.draw_scene()
  ctx.realCamera(ctx.camera._texture)

  if (ctx.health < 0 && !ctx.playerDead) {
    setTimeout(() => {
      setResolution(-1)
      ctx.health = 5
      reset()
      if (ctx.difficulty) {
        ctx.map.levels = [...ctx.map.allLevels]
      }
      ctx.map.loadLevel()
    }, 3000)
    ctx.lastNow = ctx.playerDead = now
    return
  }

  ctx.camera.theta = camera_theta
  ctx.camera.theta2 = camera_theta2
  ctx.camera.position.z = camera_z
  ctx.lights[0].position.z = light_z

  ctx.objects.forEach((x) => x.update?.(dt))

  let still_objects = ctx.objects.filter((x) => x.still)
  if (still_objects.length > 30) {
    ctx.objects = ctx.objects.filter((x) => !x.still || x.gc)
    const merged = mergeSprites(still_objects.map((x) => x.sprite as import("../mesh/sprite").Sprite).filter((x) => x))
    ;(merged as unknown as {
      still: boolean
      gc: boolean
    }).still = true
    ;(merged as unknown as {
      still: boolean
      gc: boolean
    }).gc = true
    ctx.objects.push(merged as unknown as import("../entities/types").GameObject)
  }

  ctx.minorBadness = ctx.minorBadness * 0.9 + +(dt > 30)
  ctx.totalBadness = ctx.totalBadness * 0.99 + +(dt > 30) + 5 * +(dt > 100)
  if (ctx.minorBadness > 8) {
    ctx.objects = ctx.objects.filter((x) => !x.gc)
  }
  maybeLowerGraphics()

  ctx.objects = ctx.objects.filter((x) => !x.dead)
  ctx.walls = ctx.walls.filter((x) => !x.dead)
  ctx.lastNow = now
}

export function setResolution(j: number): void {
  ctx.graphics = clamp(ctx.graphics + j, 0, 2)
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  const scale = [1, 0.7, 0.45][ctx.graphics]
  const targetW = Math.min(window.innerWidth * dpr, 1920) * scale
  canvas.width = Math.max(960, Math.round(targetW))
  canvas.height = Math.max(540, Math.round((canvas.width / window.innerWidth) * window.innerHeight))
}

export function registerGameRuntime(): void {
  setGameHooks({
    setResolution,
    reset,
    gameStep,
  })
  setStartGame(mainGo)
}
