import type { Vector } from "../math/vector"
import type { Sprite } from "../mesh/sprite"
import type { Mat4 } from "../math/matrix"

export interface Updatable {
  update(dt: number): void | boolean
}

export interface Renderable {
  render(camera?: unknown): void
}

export interface Solid {
  solid: boolean
}

export interface GameObject {
  position?: Vector
  dead?: boolean | number
  still?: boolean
  gc?: boolean
  solid?: Solid["solid"]
  isWall?: boolean
  attacking?: number | boolean
  uid?: number
  theta?: number
  _width?: number
  _height?: number
  parallel_dir?: Vector
  sprite?: Sprite | Sprite[] | null
  recoil?: Vector
  rotation?: Mat4
  parent_obj?: GameObject
  update?: Updatable["update"]
  render?: Renderable["render"]
  onhit?(other?: unknown): void
  collect?(): void
  die?(): void
}

export type FloorCache = {
  o?: {
    floorHeight: number
    ceilHeight: number
  }
}

export type CollisionHit = [Vector, GameObject]
