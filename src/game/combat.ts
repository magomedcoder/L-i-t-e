import { play } from "../audio/audio"
import { detectCollisionPositions, Flash, Hit, LightFlash, Shell } from "../entities"
import { range } from "../math/helpers"
import { newVector, urandomVector, type Vector } from "../math/vector"
import { ctx } from "../state"

export function tryShoot(now: number, screenForward: Vector, screenRight: Vector): void {
  ctx.cameraShake += 0.15 * +(ctx.cameraShake < 1.5)
  if (now - ctx.lastGunshot > 100) {
    ctx.lastGunshot = now
    play(ctx.sounds.gun)
    const hits = detectCollisionPositions(
      ctx.camera.position,
      ctx.camera.position.add(screenForward.scalarMultiply(1e4)).add(urandomVector().scalarMultiply(320 * ctx.cameraShake)),
      true,
    )

    let distanceToHit = 100
    if (hits.length > 0) {
      const hit = hits[0]
      distanceToHit = hit[0].distanceTo(ctx.chaingun.position)
      ctx.objects.push(new LightFlash(hit[0].lerp(ctx.camera.position, 0.2), 3))
      range(30).forEach(() => ctx.objects.push(new Hit(hit[0], 2)))
      hit[1].onhit?.()
    }

    ctx.objects.push(new Flash(ctx.chaingun.position, screenForward, distanceToHit))
    ctx.objects.push(new Shell(ctx.chaingun.position, screenRight))
    ctx.chaingun.recoil = newVector(0, -0.2, 0)
  }
  ctx.camera.position = ctx.camera.position.subtract(screenForward.scalarMultiply(0.1))
  ctx.speed *= 0.8
}
