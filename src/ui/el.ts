type Child = Node | string | number | false | null | undefined

type Props = Record<string, unknown> & {
  className?: string
  dataset?: Record<string, string>
  style?: Partial<CSSStyleDeclaration> | string
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  const { className, dataset, style, ...rest } = props

  if (className) {
    node.className = className
  }

  if (dataset) {
    Object.assign(node.dataset, dataset)
  }

  if (typeof style === "string") {
    node.setAttribute("style", style)
  } else if (style) {
    Object.assign(node.style, style)
  }

  for (const [key, value] of Object.entries(rest)) {
    if (value == null) {
      continue
    }

    if (key.startsWith("on") && typeof value === "function") {
      const event = key.slice(2).toLowerCase()
      node.addEventListener(event, value as EventListener)
      continue
    }

    if (key in node) {
      ;(node as unknown as Record<string, unknown>)[key] = value
      continue
    }

    node.setAttribute(key, String(value))
  }

  for (const child of children.flat()) {
    if (child == null || child === false) {
      continue
    }

    node.append(child instanceof Node ? child : String(child))
  }

  return node
}

export function button(label: string, props: Props = {}, onClick?: (e: MouseEvent) => void): HTMLButtonElement {
  return el(
    "button",
    {
      type: "button",
      ...props,
      onclick: onClick,
    },
    label,
  )
}
