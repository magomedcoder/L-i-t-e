import { range } from "../math/helpers"
import { healthBar, healthFill, healthValue, titleEl } from "../dom"
import { ctx } from "../state"

const MAX_HEALTH = 9

let lastFades: ReturnType<typeof setTimeout>[] = []

export function updateHealth(amt: number): void {
  ctx.health = Math.min(ctx.health + amt, MAX_HEALTH)
  const pct = Math.max(0, Math.min(100, Math.round(((ctx.health + 1) / (MAX_HEALTH + 1)) * 100)))
  healthFill.style.width = pct + "%"
  healthValue.textContent = pct + "%"
  healthBar.classList.toggle("low", ctx.health <= 2)
  healthBar.classList.toggle("b", ctx.health <= 2)
}

export function fadeTo(color: number[]): void {
  ctx.globalScreenColor = color.map((x) => x)
  lastFades.forEach(clearTimeout)
  lastFades = range(20).map((i) => {
    const r = i / 20
    return setTimeout(() => {
      ctx.globalScreenColor = [color[0] * r, color[1] * r, color[2] * r, color[3] * r + (1 - r)]
    }, (1 - r) * 400 + 200)
  })
}

export function setTitleLines(lines: string[]): void {
  titleEl.replaceChildren(
    ...lines.flatMap((line, i) => {
      const nodes: Node[] = [document.createTextNode(line)]
      if (i < lines.length - 1) {
        nodes.push(document.createElement("br"))
      }

      return nodes
    }),
  )
}

export function appendTitleLines(lines: string[]): void {
  if (titleEl.childNodes.length) {
    titleEl.appendChild(document.createElement("br"))
    titleEl.appendChild(document.createElement("br"))
  }

  lines.forEach((line, i) => {
    titleEl.appendChild(document.createTextNode(line))
    if (i < lines.length - 1) {
      titleEl.appendChild(document.createElement("br"))
    }
  })
}

export function clearTitle(): void {
  titleEl.replaceChildren()
}
