import { clamp } from "../math/helpers"
import { ctx } from "../state"
import { playMusic } from "../audio/audio"

export function bindKey(e: KeyboardEvent): string {
  return (({
    KeyW: "w",
    KeyA: "a",
    KeyS: "s",
    KeyD: "d"
  } as Record<string, string>)[e.code] || e.key.toLowerCase())
}

export function setupInput(): void {
  const glCanvas = ctx.gl.canvas as HTMLCanvasElement
  window.addEventListener("keydown", (e) => {
    ctx.keys[bindKey(e)] = true
  })
  window.addEventListener("keyup", (e) => {
    delete ctx.keys[bindKey(e)]
  })
  glCanvas.addEventListener("click", () => {
    glCanvas.requestPointerLock()
  })
  glCanvas.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement != glCanvas || ctx.playerDead) {
      return
    }
    ctx.camera.theta += e.movementX / 200
    ctx.camera.theta2 = clamp(ctx.camera.theta2 + e.movementY / 200, -1.3, 1.3)
  })
  glCanvas.addEventListener("mousedown", () => {
    ctx.keys._ = true
  })
  glCanvas.addEventListener("mouseup", () => {
    delete ctx.keys._
  })
  document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement == glCanvas) {
      ctx.canPlayMusic = true
      playMusic()
    }
  })
}
