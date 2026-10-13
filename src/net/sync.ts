import { ctx } from "../state"
import { mpSession } from "./session"

export function syncMultiplayerPose(now: number): void {
  if (!mpSession.ready || !ctx.camera) {
    return
  }
  
  const p = ctx.camera.position
  mpSession.tickPose(now, p.x, p.y, p.z, ctx.camera.theta, ctx.camera.theta2)
}
