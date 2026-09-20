import { reshape } from "../math/helpers"
import { IDENTITY, type Mat4, matVectorProduct } from "../math/matrix"
import { newVectorFromList, type Vector, ZERO } from "../math/vector"
import { ctx } from "../state"

export class Sprite {
  a_positions: Float32Array
  a_normals: Float32Array
  angles: Float32Array
  position: Vector
  buffers: WebGLBuffer[]
  rotation: Mat4
  transparent: boolean | number
  a_colors: Float32Array
  _texture: number
  texture_direction: number
  still?: boolean
  gc?: boolean
  isWall?: boolean
  recoil?: Vector
  private staticBuffers = false

  constructor(
    pos_and_normal: [number[], number[]],
    position: Vector | null | undefined,
    rotation?: Mat4 | number | null,
    transparent?: boolean | number | null,
    colors?: number[] | null,
    texture?: [number, number] | null,
    staticBuffers?: boolean,
  ) {
    const gl = ctx.gl
    this.a_positions = new Float32Array(pos_and_normal[0])
    this.a_normals = new Float32Array(pos_and_normal[1])
    this.angles = new Float32Array(pos_and_normal[0].map(() => Math.PI / 2))
    this.position = position || ZERO
    this.buffers = [gl.createBuffer()!, gl.createBuffer()!, gl.createBuffer()!, gl.createBuffer()!]
    this.rotation = (rotation as Mat4) || IDENTITY
    this.transparent = transparent ?? false
    this.staticBuffers = !!staticBuffers

    const cols = colors || [1, 1, 1]
    this.a_colors = new Float32Array(cols.length == pos_and_normal[0].length
      ? cols
      : Array(pos_and_normal[0].length / 3).fill(cols).flat(),
    )

    ;[this._texture, this.texture_direction] = texture || [0, 0]
    this.rebuffer(this.staticBuffers)
  }

  rebuffer(staticBuffers = this.staticBuffers): void {
    const gl = ctx.gl
    this.staticBuffers = staticBuffers
    const usage = staticBuffers ? gl.STATIC_DRAW : gl.DYNAMIC_DRAW
    ;[this.a_positions, this.a_normals, this.a_colors, this.angles].forEach((which, i) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[i])
      gl.bufferData(gl.ARRAY_BUFFER, which, usage)
    })
  }

  render(): void {
    const gl = ctx.gl
    const locations = ctx.locations
    if (this.transparent && locations == ctx.locations2) {
      return
    }

    gl.uniform4fv(
      locations.u_world_position as WebGLUniformLocation,
      this.position.negate().xyzw(),
    )

    gl.uniformMatrix4fv(locations.u_world_rotation as WebGLUniformLocation, false, this.rotation)

    ;[locations.a_position, locations.a_normal, locations.a_color, locations.a_angle].forEach((location, i) => {
      if (location === undefined || location === -1 || location === null) {
        return
      }

      const loc = location as number
      gl.enableVertexAttribArray(loc)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[i])
      gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0)
    })
    gl.uniform1i(locations.u_render_texture as WebGLUniformLocation, this.texture_direction)
    gl.uniform1i(locations.u_texture_mux as WebGLUniformLocation, this._texture - 20)
    gl.uniform1i(locations.u_render_direct as WebGLUniformLocation, this.transparent ? 1 : 0)
    gl.drawArrays(gl.TRIANGLES, 0, this.a_positions.length / 3)
  }
}

export function mergeSprites(sprites: Sprite[]): Sprite {
  const posOut: number[] = []
  const normOut: number[] = []
  const colorOut: number[] = []
  sprites.forEach((sprite) => {
    reshape(Array.from(sprite.a_positions), 3).forEach((x) => {
      posOut.push(...matVectorProduct(sprite.rotation, newVectorFromList(x)).add(sprite.position).xyz())
    })

    reshape(Array.from(sprite.a_normals), 3).forEach((x) => {
      normOut.push(...matVectorProduct(sprite.rotation, newVectorFromList(x)).normalize().xyz())
    })

    colorOut.push(...Array.from(sprite.a_colors))
  })
  
  return new Sprite([posOut, normOut], ZERO, IDENTITY, false, colorOut)
}
