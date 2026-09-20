import { newVectorFromList, type Vector } from "./vector"

export type Mat4 = number[]

export const matrixRotateYz = (theta: number): Mat4 => [1,0,0,0,0,Math.cos(theta),-Math.sin(theta),0,0,Math.sin(theta),Math.cos(theta),0,0,0,0,1]

export const matrixRotateXz = (theta: number): Mat4 => [Math.cos(theta),0,-Math.sin(theta),0,0,1,0,0,Math.sin(theta),0,Math.cos(theta),0,0,0,0,1]

export const matrixRotateXy = (theta: number): Mat4 => [Math.cos(theta),-Math.sin(theta),0,0,Math.sin(theta),Math.cos(theta),0,0,0,0,1,0,0,0,0,1]

export const matrixTranslate = (position: number[]): Mat4 => [1,0,0,position[0],0,1,0,position[1],0,0,1,position[2],0,0,0,1]

export const IDENTITY = matrixTranslate([0, 0, 0])

export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16)
  for (let cRow = 0; cRow < 4; cRow++) {
    for (let i = 0; i < 4; i++) {
      let s = 0
      for (let j = 0; j < 4; j++) {
        s += b[j * 4 + i] * a[cRow * 4 + j]
      }
      out[cRow * 4 + i] = s
    }
  }

  return out
}

export function matVectorProduct(m: Mat4, x: Vector): Vector {
  const b = x.xyzw()
  const out = [0, 0, 0, 0]
  for (let row = 0; row < 4; row++) {
    let s = 0
    for (let k = 0; k < 4; k++) {
      s += b[k] * m[row * 4 + k]
    }
    out[row] = s
  }

  return newVectorFromList(out)
}
