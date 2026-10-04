import { clamp } from "../math/helpers"
import { ctx } from "../state"
import { playMusic } from "../audio/audio"
import { prefersTouchControls, setMobileControlsVisible } from "./mobileControls"

export function bindKey(e: KeyboardEvent): string {
  return (({
    KeyW: "w",
    KeyA: "a",
    KeyS: "s",
    KeyD: "d",
    Space: " ",
  } as Record<string, string>)[e.code] || e.key.toLowerCase())
}

export function setupInput(): void {
  const glCanvas = ctx.gl.canvas as HTMLCanvasElement
  const touchUi = prefersTouchControls()
  setMobileControlsVisible(touchUi)

  window.addEventListener("keydown", (e) => {
    const key = bindKey(e)
    ctx.keys[key] = true
    if (key === " " && (document.pointerLockElement || touchUi)) {
      e.preventDefault()
    }
  })
  window.addEventListener("keyup", (e) => {
    delete ctx.keys[bindKey(e)]
  })

  glCanvas.addEventListener("click", () => {
    if (touchUi) {
      return
    }
    void glCanvas.requestPointerLock()
  })

  glCanvas.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement != glCanvas || ctx.playerDead) {
      return
    }
    ctx.camera.theta += e.movementX / 200
    ctx.camera.theta2 = clamp(ctx.camera.theta2 + e.movementY / 200, -1.3, 1.3)
  })

  glCanvas.addEventListener("mousedown", () => {
    if (touchUi) {
      return
    }
    ctx.keys._ = true
  })
  glCanvas.addEventListener("mouseup", () => {
    if (touchUi) {
      return
    }
    delete ctx.keys._
  })

  document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement == glCanvas) {
      ctx.canPlayMusic = true
      playMusic()
    }
  })

  window.addEventListener("orientationchange", () => {
    setMobileControlsVisible(prefersTouchControls())
  })
}
