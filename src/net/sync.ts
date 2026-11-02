import { ctx } from "../state"
import { mpSession } from "./session"

export function syncMultiplayerPose(now: number): void {
  if (!mpSession.ready || !ctx.camera) {
    return
  }
  
  void now
  const p = ctx.camera.position
  const jumping = ctx.jumpVelocity > 0.02 || !!ctx.keys[" "]
  const firing = !!ctx.keys._
  mpSession.tickPose({
    x: p.x,
    y: p.y,
    z: p.z,
    yaw: ctx.camera.theta,
    pitch: ctx.camera.theta2,
    jump: jumping ? 1 : 0,
    fire: firing ? 1 : 0,
    health: ctx.health,
  })
}
