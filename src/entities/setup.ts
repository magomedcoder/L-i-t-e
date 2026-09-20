import { range } from "../math/helpers"
import { matrixRotateYz, matVectorProduct } from "../math/matrix"
import { newVector, Y_DIR, ZERO } from "../math/vector"
import { mergeSprites, Sprite } from "../mesh/sprite"
import { ctx } from "../state"
import { Enemy, FlyingEnemy, ManyEnemies } from "./enemies"
import { Flashlight, Goal, Health } from "./collectables"
import { LockedDoor } from "./hitbox"
import { initMeshes, makeCylinder } from "./meshes"

export const objectByType = {
  enemy: Enemy,
  flying: FlyingEnemy,
  health: Health,
  goal: Goal,
  door: LockedDoor,
  flashlight: Flashlight,
  many: ManyEnemies,
} as const

export function setupGame(): void {
  initMeshes()

  const parts: Sprite[] = [];[2, 5, 6].forEach((x) => parts.push(
    new Sprite(
      makeCylinder(newVector(1.8, 1.8, 0.5)),
      newVector(x, 0, 0), null, false, [0.12, 0.16, 0.2]
    ),
  ))
  range(8).forEach((x) => {
    parts.push(
      new Sprite(
        makeCylinder(newVector(0.5, 0.5, 8.5)),
        matVectorProduct(matrixRotateYz((x * Math.PI) / 4), Y_DIR),
        null,
        false,
        [0.2, 0.55, 0.65],
      ),
    )
  })

  const gun = mergeSprites(parts)
  gun.recoil = ZERO
  ctx.chaingun = gun as typeof ctx.chaingun
}
