import { cartesianProductMap, pairs, push, range, reshape } from "../math/helpers"
import { matrixRotateXy, matVectorProduct } from "../math/matrix"
import { newVector, normalToPlane, reduceMean, type Vector, ZERO } from "../math/vector"

export function lathe(points: number[], num_steps: number, _subdivisions: number, has_cap: boolean, post_proc?: (v: Vector) => Vector): [number[], number[]] {
  let prev = ZERO
  const pts = reshape(points, 2).map((x) => (prev = newVector(0, x[0], x[1]).add(prev)))
  const all_points = range(num_steps).map((i) => pts.map((x) => matVectorProduct(matrixRotateXy(((2 * Math.PI) / num_steps) * i), x))).flat()
  const N = pts.length

  const faces: number[][] = cartesianProductMap(
    range(N - 1),
    range(num_steps),
    (z_step, theta_step) => [
      0 + z_step + theta_step * N,
      1 + z_step + theta_step * N,
      N + 1 + z_step + theta_step * N,
      N + z_step + theta_step * N,
    ],
  )
  if (has_cap) {
    faces.push(range(num_steps).map((x) => x * N))
    faces.push(range(num_steps).reverse().map((x) => x * N + N - 1),)
  }
  const processed = all_points.map(post_proc || ((x) => x))
  const faceVerts = faces.map((face) => face.map((y) => processed[y % processed.length]))

  return makeOutputFromFaces(faceVerts)
}

export function makeOutputFromFaces(faces: Vector[][]): [number[], number[]] {
  const out_vertices: Vector[] = []
  const out_normals: Vector[] = []
  const vert_to_normal: Record<string, number[]> = {}

  const triangles = faces.map((face) => pairs(face, (x, y) => [face[0], x, y] as Vector[]).slice(1)).flat(1)

  triangles.forEach((triangle) => {
    const normal = normalToPlane(triangle[0], triangle[1], triangle[2])
    triangle.forEach((x, i) => {
      vert_to_normal[x.id()] = push(vert_to_normal[x.id()] || [], out_normals.length + i)
    })
    out_vertices.push(...triangle)
    out_normals.push(normal, normal, normal)
  })

  out_vertices.forEach((vert) => {
    const idxs = vert_to_normal[vert.id()]
    const idxs_normals = idxs.map((x) => out_normals[x])
    const mean_normal = reduceMean(idxs_normals)
    if (idxs_normals.every((x) => mean_normal.dot(x) > 0.8)) {
      idxs.forEach((x) => {
        out_normals[x] = mean_normal
      })
    }
  })

  return [out_vertices.map((x) => x.xyz()).flat(), out_normals.map((x) => x.xyz()).flat()]
}
