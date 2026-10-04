import { el } from "../ui/el"
import { ctx } from "../state"
import { clamp } from "../math/helpers"

const DEADZONE = 0.22
const LOOK_SENS = 0.0045

type StickState = {
  pointerId: number | null
  originX: number
  originY: number
  radius: number
}

type LookState = {
  pointerId: number | null
  lastX: number
  lastY: number
}

const stick: StickState = {
  pointerId: null,
  originX: 0,
  originY: 0,
  radius: 56,
}

const look: LookState = {
  pointerId: null,
  lastX: 0,
  lastY: 0,
}

const heldButtons = new Set<string>()

let root: HTMLElement | null = null
let knob: HTMLElement | null = null
let active = false

export function prefersTouchControls(): boolean {
  if (typeof window === "undefined") {
    return false
  }
  
  if (new URLSearchParams(window.location.search).has("touch")) {
    return true
  }

  return window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0
}

export function createMobileControls(): HTMLElement {
  knob = el("div", { className: "mobile-stick-knob" })
  const base = el("div", { className: "mobile-stick-base" }, knob)
  const stickPad = el("div", {
    className: "mobile-stick",
    id: "mobileStick",
  }, base)

  const jumpBtn = el("button", {
    type: "button",
    className: "mobile-btn mobile-jump",
    id: "mobileJump",
    "aria-label": "Jump",
  }, "↑")
  const fireBtn = el("button", {
    type: "button",
    className: "mobile-btn mobile-fire",
    id: "mobileFire",
    "aria-label": "Fire",
  }, "●")

  const actions = el("div", { className: "mobile-actions" }, jumpBtn, fireBtn)
  const lookPad = el("div", {
    className: "mobile-look",
    id: "mobileLook",
  })

  root = el(
    "div",
    {
      id: "mobileControls",
      className: "mobile-controls",
      hidden: true,
    },
    lookPad,
    stickPad,
    actions,
  )

  bindStick(stickPad)
  bindLook(lookPad)
  bindHoldButton(fireBtn, "_")
  bindHoldButton(jumpBtn, " ")

  return root
}

export function setMobileControlsVisible(visible: boolean): void {
  active = visible && prefersTouchControls()
  if (!root) {
    return
  }

  root.hidden = !active
  document.body.classList.toggle("touch-ui", active)
  if (!active) {
    releaseAll()
  }
}

export function syncMobileKeys(): void {
  if (!active) {
    return
  }

  for (const key of heldButtons) {
    ctx.keys[key] = true
  }
}

function enablePlayback(): void {
  if (ctx.canPlayMusic) {
    return
  }

  ctx.canPlayMusic = true
  void import("../audio/audio").then(({ playMusic }) => playMusic())
}

function setMoveKeys(nx: number, ny: number): void {
  delete ctx.keys.w
  delete ctx.keys.a
  delete ctx.keys.s
  delete ctx.keys.d
  heldButtons.delete("w")
  heldButtons.delete("a")
  heldButtons.delete("s")
  heldButtons.delete("d")

  if (Math.hypot(nx, ny) < DEADZONE) {
    return
  }

  if (ny < -DEADZONE) {
    ctx.keys.w = true
    heldButtons.add("w")
  }

  if (ny > DEADZONE) {
    ctx.keys.s = true
    heldButtons.add("s")
  }

  if (nx < -DEADZONE) {
    ctx.keys.a = true
    heldButtons.add("a")
  }

  if (nx > DEADZONE) {
    ctx.keys.d = true
    heldButtons.add("d")
  }
}

function updateKnob(nx: number, ny: number): void {
  if (!knob) {
    return
  }

  const mag = Math.min(1, Math.hypot(nx, ny))
  const angle = Math.atan2(ny, nx)
  const px = Math.cos(angle) * mag * 34
  const py = Math.sin(angle) * mag * 34
  knob.style.transform = `translate(${px}px, ${py}px)`
}

function resetKnob(): void {
  if (knob) {
    knob.style.transform = "translate(0, 0)"
  }
}

function bindStick(pad: HTMLElement): void {
  pad.addEventListener("pointerdown", (e) => {
    if (stick.pointerId != null || e.button > 0) {
      return
    }

    e.preventDefault()
    e.stopPropagation()
    enablePlayback()
    const rect = pad.getBoundingClientRect()
    stick.pointerId = e.pointerId
    stick.originX = rect.left + rect.width / 2
    stick.originY = rect.top + rect.height / 2
    stick.radius = Math.min(rect.width, rect.height) / 2
    pad.setPointerCapture(e.pointerId)
    pad.classList.add("active")
    onStickMove(e.clientX, e.clientY)
  })

  pad.addEventListener("pointermove", (e) => {
    if (stick.pointerId !== e.pointerId) {
      return
    }

    e.preventDefault()
    onStickMove(e.clientX, e.clientY)
  })

  const end = (e: PointerEvent) => {
    if (stick.pointerId !== e.pointerId) {
      return
    }

    stick.pointerId = null
    pad.classList.remove("active")
    setMoveKeys(0, 0)
    resetKnob()
  }

  pad.addEventListener("pointerup", end)
  pad.addEventListener("pointercancel", end)
}

function onStickMove(clientX: number, clientY: number): void {
  const dx = (clientX - stick.originX) / stick.radius
  const dy = (clientY - stick.originY) / stick.radius
  const mag = Math.hypot(dx, dy)
  const nx = mag > 1 ? dx / mag : dx
  const ny = mag > 1 ? dy / mag : dy
  updateKnob(nx, ny)
  setMoveKeys(nx, ny)
}

function bindLook(pad: HTMLElement): void {
  pad.addEventListener("pointerdown", (e) => {
    if (look.pointerId != null || e.button > 0 || ctx.playerDead) {
      return
    }

    e.preventDefault()
    enablePlayback()
    look.pointerId = e.pointerId
    look.lastX = e.clientX
    look.lastY = e.clientY
    pad.setPointerCapture(e.pointerId)
  })

  pad.addEventListener("pointermove", (e) => {
    if (look.pointerId !== e.pointerId || ctx.playerDead) {
      return
    }

    e.preventDefault()
    const dx = e.clientX - look.lastX
    const dy = e.clientY - look.lastY
    look.lastX = e.clientX
    look.lastY = e.clientY
    ctx.camera.theta += dx * LOOK_SENS
    ctx.camera.theta2 = clamp(ctx.camera.theta2 + dy * LOOK_SENS, -1.3, 1.3)
  })

  const end = (e: PointerEvent) => {
    if (look.pointerId !== e.pointerId) {
      return
    }

    look.pointerId = null
  }

  pad.addEventListener("pointerup", end)
  pad.addEventListener("pointercancel", end)
}

function bindHoldButton(btn: HTMLElement, key: string): void {
  const press = (e: PointerEvent) => {
    if (e.button > 0) {
      return
    }

    e.preventDefault()
    e.stopPropagation()
    enablePlayback()
    btn.setPointerCapture(e.pointerId)
    btn.classList.add("active")
    ctx.keys[key] = true
    heldButtons.add(key)
  }

  const release = () => {
    if (!heldButtons.has(key)) {
      return
    }

    btn.classList.remove("active")
    delete ctx.keys[key]
    heldButtons.delete(key)
  }

  btn.addEventListener("pointerdown", press)
  btn.addEventListener("pointerup", release)
  btn.addEventListener("pointercancel", release)
  btn.addEventListener("lostpointercapture", () => {
    btn.classList.remove("active")
    delete ctx.keys[key]
    heldButtons.delete(key)
  })
}

function releaseAll(): void {
  stick.pointerId = null
  look.pointerId = null
  for (const key of heldButtons) {
    delete ctx.keys[key]
  }

  heldButtons.clear()
  setMoveKeys(0, 0)
  resetKnob()
  root?.querySelectorAll(".active").forEach((node) => node.classList.remove("active"))
}
