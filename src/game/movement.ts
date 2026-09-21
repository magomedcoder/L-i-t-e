import { detectCollisionPositions, Wall } from "../entities"
import { matrixRotateXy, matVectorProduct } from "../math/matrix"
import { clamp, range } from "../math/helpers"
import { newVector, type Vector, X_DIR, Y_DIR, Z_DIR } from "../math/vector"
import { ctx } from "../state"

const EYE = 10
const JUMP_SPEED = 0.42
const GRAVITY = 0.00135
const TERMINAL = 1.2
const HEADROOM = 4
const GROUND_EPS = 1.2

export function collectMoveDirs(dt: number): Vector[] {
  const moveDirs: Vector[] = []
  for (const key in ctx.keys) {
    const goDir = "sawd".indexOf(key)
    if (goDir !== -1) {
      ctx.speed += +(ctx.speed < 1) * 0.1
      moveDirs.push(matVectorProduct(matrixRotateXy(-ctx.camera.theta - (Math.PI / 2) * goDir), Y_DIR.scalarMultiply(-dt / 12)))
    }
  }

  return moveDirs
}

export function clipAgainstWalls(currentPos: Vector): void {
  range(8).forEach((alpha) => {
    const hits = detectCollisionPositions(
      ctx.camera.position.subtract(Z_DIR.scalarMultiply(5)),
      ctx.camera.position.add(newVector(6 * Math.sin((alpha / 4) * Math.PI), 6 * Math.cos((alpha / 4) * Math.PI), -5)),
    )
    hits.filter((x) => x[1] instanceof Wall).forEach((hit) => {
      const objPerp = matVectorProduct(matrixRotateXy(hit[1].theta!), X_DIR)
      const objParallel = matVectorProduct(matrixRotateXy(hit[1].theta!), Y_DIR)
      const where = hit[1].position!.add(objParallel.scalarMultiply(objParallel.dot(ctx.camera.position.subtract(hit[1].position!))))
      ctx.camera.position = where.add(objPerp.scalarMultiply(6 * (where.add(objPerp).distanceTo(currentPos) < where.distanceTo(currentPos) ? 1 : -1)))
      ctx.camera.position.z = currentPos.z
    })
  })
}

export function applyVerticalMotion(dt: number): void {
  const floorZ = ctx.map.getFloorHeight(ctx.camera.position)
  const eyeTarget = floorZ + EYE
  const wantJump = !!ctx.keys[" "]
  const onGround = ctx.camera.position.z <= eyeTarget + GROUND_EPS && ctx.jumpVelocity <= 0.02

  if (wantJump && !ctx.jumpHeld && onGround) {
    ctx.jumpVelocity = JUMP_SPEED
  }
  
  ctx.jumpHeld = wantJump

  const airborne = !onGround || ctx.jumpVelocity > 0.02
  if (airborne) {
    ctx.jumpVelocity -= GRAVITY * dt
    if (ctx.jumpVelocity < -TERMINAL) {
      ctx.jumpVelocity = -TERMINAL
    }
    ctx.camera.position.z += ctx.jumpVelocity * dt

    if (ctx.camera.position.z < eyeTarget) {
      ctx.camera.position.z = eyeTarget
      ctx.jumpVelocity = 0
    }

    const region = ctx.map.getRegionAt(ctx.camera.position)
    if (region) {
      const maxZ = region.ceilHeight - HEADROOM
      if (ctx.camera.position.z > maxZ) {
        ctx.camera.position.z = maxZ
        if (ctx.jumpVelocity > 0) {
          ctx.jumpVelocity = 0
        }
      }
    }
  } else {
    const fallRate = eyeTarget - ctx.camera.position.z
    ctx.camera.position.z += clamp((fallRate * dt) / 30, -2, 3)
    ctx.jumpVelocity = 0
  }
}
