import { range } from "../math/helpers"
import { matrixRotateXy, matrixRotateXz, matVectorProduct } from "../math/matrix"
import { newVector, type Vector, Z_DIR } from "../math/vector"
import { mergeSprites, Sprite } from "../mesh/sprite"
import { ctx } from "../state"
import type { GameObject } from "./types"
import { makeCube, makeCylinder, pallet } from "./meshes"

export class HitBox implements GameObject {
  parent_obj: GameObject
  solid = true
  position: Vector
  theta: number
  _width: number
  _height: number
  parallel_dir: Vector
  offset: number
  dead?: boolean | number

  constructor(parent: GameObject, theta: number, width: number, height: number, offset?: number) {
    this.parent_obj = parent
    this.position = parent.position!
    this.theta = theta
    this._width = width
    this._height = height
    this.parallel_dir = newVector(
      -Math.sin(this.theta) * this._width,
      Math.cos(this.theta) * this._width,
      0,
    )
    this.offset = offset || 0
  }

  update(): void {
    this.position = this.parent_obj.position!.add(Z_DIR.scalarMultiply(this.offset))
    this.dead = this.parent_obj.dead
  }

  render(): void {}

  onhit(other?: unknown): void {
    this.parent_obj.onhit?.(other)
  }
}

export class Wall extends HitBox {
  constructor(position: Vector, theta: number, width: number, height: number) {
    if (height < 0) {
      height = -height
      position.z -= height
    }

    super(
      {
        position,
        onhit: () => {},
      },
      theta,
      width,
      height,
    )
    ctx.walls.push(this)
  }
}

export class LockedDoor extends Wall {
  uid: number
  sprite: Sprite

  constructor(position: Vector, pairId: number, rotation?: number) {
    const theta = rotation ?? pairId
    super(position, theta, 32, 30)
    this.uid = pairId
    this.sprite = pairId == Math.PI / 2 ? new Sprite(
      makeCube(newVector(1, 64, 40)),
      this.position,
      matrixRotateXy(theta),
      null,
      [1, 1, 1],
      [21, 2],
    ) : mergeSprites(
      range(20).map((off) => new Sprite(
        makeCylinder(newVector(1, 1, 40)),
        position.add(matVectorProduct(matrixRotateXy(theta), newVector(0, off * 4 - 40, 0))),
        matrixRotateXz(Math.PI / 2),
        1,
        pallet[(pairId * 8) / Math.PI],
      )),
    )
  }

  render(): void {
    this.sprite.render()
  }
}
