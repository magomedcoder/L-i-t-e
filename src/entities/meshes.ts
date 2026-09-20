import { lathe } from "../mesh/lathe"
import { matrixRotateXy, matrixRotateXz, matVectorProduct } from "../math/matrix"
import type { Vector } from "../math/vector"

export type MeshData = [number[], number[]]

export const pallet: number[][] = [
  [0.2, 1.0, 0.85],
  [0.25, 0.65, 1.2],
  [1.1, 0.85, 0.15],
  [1.2, 0.25, 0.55],
  [0.4, 1.3, 0.5],
]

export const makeCylinder = (dims: Vector): MeshData => lathe([1, 0, 0, 0.001, 0, 1, 0, 0.001], 48, 0, true, (x) => matVectorProduct(matrixRotateXz(-Math.PI / 2), x.vectorMultiply(dims)))

export const makeCubeFn = (fn: (v: Vector) => Vector): MeshData => lathe([0.71, 0, 0, 1], 4, 0, true, (x) => fn(matVectorProduct(matrixRotateXy(-Math.PI / 4), x)))

export const makeCube = (dims: Vector): MeshData => makeCubeFn((x) => x.vectorMultiply(dims))

export let explosion: MeshData

export let sphere: (m: number) => MeshData

export let shell: MeshData

export let enemy_bullet: MeshData

export function initMeshes(): void {
  sphere = (m) => lathe([0, -0.5, 0.35, 0.15, 0.15, 0.35, -0.15, 0.35, -0.35, 0.15].map((x) => x * m), 16, 0, false)
  explosion = sphere(1)
  shell = lathe([0.5, 0, 0, 0.05, -0.1, 0, 0, 0.01, 0, 1.5, 0, 0.01, -0.05, 0, 0, -1.4], 12, 0, true)
  enemy_bullet = lathe([0.2, 0, 0.2, 2, 0.4, 1, 0.4, 0.4, 0, 0.6, -0.4, 0.4, -0.4, 0.2], 48, 0, true, (x) => matVectorProduct(matrixRotateXz(-Math.PI / 2), x))
}
