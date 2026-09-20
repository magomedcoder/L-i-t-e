type Point = {
  x: number
  y: number
}

export function pointInPolygon(x: number, y: number, verts: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const [xi, yi] = verts[i]
    const [xj, yj] = verts[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }

  return inside
}

export function pointInPolygonPoint(position: Point, verts: [number, number][]): boolean {
  return pointInPolygon(position.x, position.y, verts)
}

export function edgeKey(a: Point, b: Point): string {
  const ax = a.x
  const ay = a.y
  const bx = b.x
  const by = b.y
  if (ax < bx || (ax === bx && ay <= by)) {
    return `${ax},${ay},${bx},${by}`
  }
  
  return `${bx},${by},${ax},${ay}`
}
