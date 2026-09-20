import { push, urandom } from "./helpers"

export class Vector {
  x: number
  y: number
  z: number

  constructor(x?: number, y?: number, z?: number) {
    this.x = +x || 0
    this.y = +y || 0
    this.z = +z || 0
  }

  set(x: number, y: number, z: number): this {
    this.x = x
    this.y = y
    this.z = z
    return this
  }

  copyFrom(other: Vector): this {
    return this.set(other.x, other.y, other.z)
  }

  add(other: Vector): Vector {
    return newVector(this.x + other.x, this.y + other.y, this.z + other.z)
  }

  addInto(other: Vector, out: Vector): Vector {
    return out.set(this.x + other.x, this.y + other.y, this.z + other.z)
  }

  subtract(other: Vector): Vector {
    return this.add(other.negate())
  }

  subtractInto(other: Vector, out: Vector): Vector {
    return out.set(this.x - other.x, this.y - other.y, this.z - other.z)
  }

  negate(): Vector {
    return this.scalarMultiply(-1)
  }

  scalarMultiply(c: number): Vector {
    return newVector(this.x * c, this.y * c, this.z * c)
  }

  scalarMultiplyInto(c: number, out: Vector): Vector {
    return out.set(this.x * c, this.y * c, this.z * c)
  }

  vectorMultiply(other: Vector): Vector {
    return newVector(this.x * other.x, this.y * other.y, this.z * other.z)
  }

  dot(other: Vector): number {
    return this.x * other.x + this.y * other.y + this.z * other.z
  }

  xyz(): number[] {
    return [this.x, this.y, this.z]
  }

  xyzw(): number[] {
    return push(this.xyz(), 0)
  }

  lerp(other: Vector, frac: number): Vector {
    return this.scalarMultiply(1 - frac).add(other.scalarMultiply(frac))
  }

  cross(other: Vector): Vector {
    return newVector(
      this.y * other.z - this.z * other.y,
      this.z * other.x - this.x * other.z,
      this.x * other.y - this.y * other.x,
    )
  }

  copy(): Vector {
    return newVectorFromList(this.xyz())
  }

  lengthSquared(): number {
    return this.dot(this)
  }

  vectorLength(): number {
    return this.lengthSquared() ** 0.5
  }

  distanceTo(other: Vector): number {
    return this.subtract(other).vectorLength()
  }

  noz(): Vector {
    return newVector(this.x, this.y, 0)
  }

  normalize(): Vector {
    return this.scalarMultiply(1.0 / (this.vectorLength() + 1e-30))
  }

  id(): string {
    return "" + this.xyz().map((x) => x.toFixed(4))
  }
}

export const newVector = (a?: number, b?: number, c?: number): Vector => new Vector(a, b, c)

export const newVectorFromList = (x: number[]): Vector => newVector(x[0], x[1], x[2])

export const reduceAdd = (lst: Vector[]): Vector => lst.reduce((a, b) => a.add(b))

export const reduceMean = (lst: Vector[]): Vector => reduceAdd(lst).scalarMultiply(1 / lst.length)

export const angleBetween = (a: Vector, b: Vector): number => Math.atan2(a.subtract(b).x, a.subtract(b).y)

export const normalToPlane = (a: Vector, b: Vector, c: Vector): Vector => a.subtract(b).cross(c.subtract(b)).normalize()

export function rayLineIntersect(o: Vector, dir: Vector, p1: Vector, p2: Vector): [number, number] | undefined {
  const v1 = o.subtract(p1)
  const v2 = p2.subtract(p1)
  const v3 = newVector(-dir.y, dir.x, 0)

  const t1 = (v2.x * v1.y - v2.y * v1.x) / v2.dot(v3)
  const t2 = v1.dot(v3) / v2.dot(v3)

  if (t1 >= 0 && t2 >= 0 && t2 <= 1) {
    return [t1, t2]
  }
}

export const ZERO = new Vector(0, 0, 0)
export const X_DIR = newVector(1, 0, 0)
export const Y_DIR = newVector(0, 1, 0)
export const Z_DIR = newVector(0, 0, 1)

export const urandomVector = (): Vector => newVector(urandom(), urandom(), urandom())
