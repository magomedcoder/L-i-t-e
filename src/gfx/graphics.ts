import { cartesianProductMap, range } from "../math/helpers"
import { IDENTITY, type Mat4, matrixRotateXy, matrixRotateXz, matrixRotateYz, matrixTranslate, multiply} from "../math/matrix"
import { newVector, type Vector } from "../math/vector"
import { lathe } from "../mesh/lathe"
import { Sprite } from "../mesh/sprite"
import { ctx } from "../state"
import { program1Shader } from "./shaders"
import type { ShaderLocations } from "./types"

export const fragmentShaderHeader = `#version 300 es
precision mediump float;

in vec4 v_normal,world_position,v_color,v_angle,v_project_onto_light[5];

uniform bool u_render_direct,u_is_light_shadow[5];
uniform int u_which_shadow_light,u_texture_mux,u_render_texture;
uniform vec4 u_shift_color,u_light_position[5];
uniform float u_ambient_light,u_light_brightness[5];
uniform sampler2D u_texture[9];

out vec4 out_color;

vec4 get_shader(int i, vec2 texpos) {
  switch(i) {
  ${range(9)
  .map((x) => "case " + x + ":return texture(u_texture[" + x + "],texpos)")
  .join(";")};
  }
}`

export function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (import.meta.env.DEV) {
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.log(
        source.split("\n").map((x, i) => i + 1 + ":" + x).join("\n"),
      )
      console.log(gl.getShaderInfoLog(shader))
      gl.deleteShader(shader)
      throw new Error("Shader compile failed")
    }
  }

  return shader
}

export function createProgram(gl: WebGL2RenderingContext, fragmentShaderSource: string): [WebGLProgram, ShaderLocations] {
  const program = gl.createProgram()!
  const vertexShaderSource = `#version 300 es
precision mediump float;

in vec4 a_position,a_normal,a_color,a_angle;

out vec4 v_normal,world_position,v_color,v_angle;
out vec4 v_project_onto_light[5];

uniform vec4 u_world_position,u_light_position[5];
uniform mat4 u_world_rotation,u_light_matrix[5];

void main() {
  world_position = a_position * u_world_rotation - u_world_position;
  v_normal = a_normal * u_world_rotation;

  for (int i = 0; i < 5; i++) {
    gl_Position = v_project_onto_light[i] = u_light_matrix[i] * world_position;
  }
  v_color = a_color;
  v_angle = a_angle;
}
`

  gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vertexShaderSource))
  gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource))
  gl.linkProgram(program)

  if (import.meta.env.DEV && !gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.log(gl.getProgramInfoLog(program))
    gl.deleteProgram(program)
    throw new Error("Program link failed")
  }

  const locations: ShaderLocations = {}
  let prev_in = true
  ;(fragmentShaderHeader + vertexShaderSource).match(/[a-zA-Z_]+(\[[0-9]\])?/g)!.forEach((tok) => {
    let toks = [tok]
    if (tok.indexOf("[") > 0) {
      toks = range(32).map((x) => tok.replace(/[0-9]/, String(x)))
    }

    if (tok == "in") {
      prev_in = true
    }

    if (tok == "uniform") {
      prev_in = false
    }

    toks.forEach((t) => {
      locations[t] ??= prev_in ? gl.getAttribLocation(program, t) : gl.getUniformLocation(program, t)
    })
  })

  return [program, locations]
}

export function makeProjMatrix(fov: number, aspect: number, rotation: Mat4, position: Vector): Mat4 {
  const f = Math.tan(Math.PI / 2 - fov / 2)
  const matrices: Mat4[] = [
    [f / aspect, 0, 0, 0, 0, 0, f, 0, 0, 1, 0, 0, 0, 1, 0, 1],
    rotation,
    matrixTranslate(position.negate().xyz()),
  ]

  return matrices.reduce(multiply)
}

export class Camera {
  position: Vector
  dimensions: number[]
  theta: number
  theta2: number
  theta3: number
  cull: number
  camera_is_light: boolean
  fov: number
  aspect: number
  shadow_camera: Camera
  texture_id: number
  _texture: WebGLTexture
  framebuffer: WebGLFramebuffer | null

  constructor(
    position: Vector,
    dimensions: number[],
    fov: number,
    camera_is_light: boolean,
    texture_id: number,
    theta?: number,
    theta2?: number,
  ) {
    this.position = position
    this.dimensions = dimensions
    this.theta = theta || 0
    this.theta2 = theta2 || 0
    this.theta3 = 0
    this.cull = ctx.gl.FRONT
    this.camera_is_light = camera_is_light
    this.fov = fov
    this.aspect = dimensions[0] / dimensions[1]
    this.shadow_camera = this
    this.texture_id = texture_id
    ;[this._texture, this.framebuffer] = setupFramebuffer(
      texture_id,
      camera_is_light,
      dimensions[0],
      dimensions[1],
    )
  }

  draw_scene(): void {
    const gl = ctx.gl
    const locations = ctx.locations
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)

    ctx.allTextures.forEach((tex, i) => {
      const unit = 8 + i
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.uniform1i(locations[`u_texture[${i + 4}]`] as WebGLUniformLocation, unit)
    })

    ;[...ctx.lights.slice(0, 4), this as unknown as Light].forEach((light: any, i: number) => {
      gl.uniform4fv(
        locations[`u_light_position[${i}]`] as WebGLUniformLocation,
        light.position.xyzw(),
      )
      gl.uniformMatrix4fv(
        locations[`u_light_matrix[${i}]`] as WebGLUniformLocation,
        true,
        makeProjMatrix(
          light.shadow_camera.fov,
          light.shadow_camera.aspect,
          [
            matrixRotateXz(light.shadow_camera.theta3),
            matrixRotateYz(light.shadow_camera.theta2),
            matrixRotateXy(light.shadow_camera.theta),
          ].reduce(multiply),
          light.shadow_camera.position,
        ),
      )

      if (!this.camera_is_light && i < 4) {
        gl.activeTexture(gl.TEXTURE0 + light.id)
        gl.bindTexture(gl.TEXTURE_2D, light.filter._texture)
        gl.uniform1i(locations[`u_texture[${i}]`] as WebGLUniformLocation, light.id)
      }

      gl.uniform1i(locations[`u_is_light_shadow[${i}]`] as WebGLUniformLocation, light.shadow ? 1 : 0)
      gl.uniform1f(locations[`u_light_brightness[${i}]`] as WebGLUniformLocation, light.brightness || 0)
    })

    if (!ctx.goingBack || ctx.framecount++ % 200 < 10) {
      gl.uniform1f(locations.u_ambient_light as WebGLUniformLocation, 0.035)
      ctx.lights[0].brightness = 1.8
      ctx.lights[1].brightness = 0.9
      ctx.lights[2].brightness = 2.2
      ctx.lights[3].brightness = 5
    } else {
      gl.uniform1f(locations.u_ambient_light as WebGLUniformLocation, 1e-4)
      ctx.lights[0].brightness = 7
      ctx.lights[1].brightness = 0
      ctx.lights[2].brightness = 8
      ctx.lights[3].brightness = 30
    }

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.enable(gl.DEPTH_TEST)
    if (this.cull) {
      gl.enable(gl.CULL_FACE)
      gl.cullFace(this.cull)
    }

    gl.viewport(0, 0, this.dimensions[0], this.dimensions[1])
    ctx.objects.forEach((obj: any) => {
      if (!this.camera_is_light || !obj.gc) {
        obj.render?.()
      }
    })
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }
}

export class Filter {
  _texture: WebGLTexture
  framebuffer: WebGLFramebuffer | null
  post_filter: (sourceTexture: WebGLTexture, other_texture?: WebGLTexture) => WebGLTexture

  constructor(code: string, W: number, H: number, type?: number, _extra_code?: string) {
    const gl = ctx.gl
    const sprite = new Sprite(lathe([5, 0], 4, 0, true), newVector(0, 0, 0), null, false)

    const [shaderProgram, prog_locations] = createProgram(
        gl,
        fragmentShaderHeader +
        `vec4 get_tex(int i, vec2 xy_pos) {
  return get_shader(i, (world_position.xy*.5+.5) + xy_pos/vec2(${W | 0}.,${H | 0}.));
}

vec4 get_tex() {
  return get_tex(0, vec2(0));
}

void main(void) {
${code}
}`,
      )

    ;[this._texture, this.framebuffer] = setupFramebuffer(14, type == gl.RG, W, H)

    this.post_filter = (sourceTexture, other_texture) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)
      gl.useProgram(shaderProgram)

      gl.uniform4fv(prog_locations.u_shift_color as WebGLUniformLocation, ctx.globalScreenColor)

      ;(
        [
          [sourceTexture, "u_texture[0]", 14],
          [other_texture, "u_texture[1]", 15],
        ] as const
      ).forEach((arg) => {
        if (arg[0]) {
          gl.activeTexture(gl.TEXTURE0 + arg[2])
          gl.bindTexture(gl.TEXTURE_2D, arg[0])
          gl.uniform1i(prog_locations[arg[1]] as WebGLUniformLocation, arg[2])
        }
      })

      gl.uniform4fv(prog_locations.u_world_position as WebGLUniformLocation, [0, 0, 0, 0])
      gl.uniformMatrix4fv(prog_locations.u_world_rotation as WebGLUniformLocation, false, IDENTITY)
      gl.uniformMatrix4fv(
        prog_locations["u_light_matrix[4]"] as WebGLUniformLocation,
        false,
        IDENTITY,
      )

      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      gl.viewport(0, 0, W, H)
      ctx.locations = prog_locations
      sprite.render()
      return this._texture
    }
  }
}

const gaussian_2d = `vec4 the_res;
for (float i = -6.; i < 7.; i++) {
  for (float j = -6.; j < 7.; j++) {
    the_res += exp(-i*i/9.-j*j/9.)*get_tex(0,vec2(j,i));
  }
}
out_color = the_res/28.17;`

export function createScreenComposer(): (sourceTexture: WebGLTexture) => WebGLTexture {
  const gl = ctx.gl
  const W = gl.canvas.width
  const H = gl.canvas.height

  const filters = [
    new Filter(
      `out_color = dot(get_tex(), vec4(21, 72, 7,0)) > 100. ? get_tex() : vec4(0,0,0,1);`,
      W,
      H,
      gl.RGBA,
    ),
    new Filter("out_color = get_tex();", W / 4, H / 4, gl.RGBA),
    new Filter(gaussian_2d, W / 4, H / 4, gl.RGBA),
    new Filter("out_color = get_tex();", W, H),
    new Filter(
      "out_color = vec4(u_shift_color.rgb + u_shift_color.w*(get_tex(1,vec2(0)) + get_tex()).rgb, 1.);",
      W,
      H,
      gl.RGBA,
    ),
    new Filter(
      `vec4 c = get_tex();
vec4 n = get_tex(0, vec2(0, 1));
vec4 s = get_tex(0, vec2(0, -1));
vec4 e = get_tex(0, vec2(1, 0));
vec4 ww = get_tex(0, vec2(-1, 0));
vec4 ne = get_tex(0, vec2(1, 1));
vec4 nw = get_tex(0, vec2(-1, 1));
vec4 se = get_tex(0, vec2(1, -1));
vec4 sw = get_tex(0, vec2(-1, -1));
vec3 lumaW = vec3(0.299, 0.587, 0.114);
float lM = dot(c.rgb, lumaW);
float lN = dot(n.rgb, lumaW);
float lS = dot(s.rgb, lumaW);
float lE = dot(e.rgb, lumaW);
float lW = dot(ww.rgb, lumaW);
float lMax = max(lM, max(max(lN, lS), max(lE, lW)));
float lMin = min(lM, min(min(lN, lS), min(lE, lW)));
float contrast = lMax - lMin;
vec4 blur = (n + s + e + ww) * 0.15 + (ne + nw + se + sw) * 0.1 + c * 0.2;
float edge = smoothstep(0.04, 0.18, contrast);
out_color = mix(c, blur, edge * 0.85);
out_color.a = 1.;`,
      W,
      H,
      gl.RGBA,
    ),
  ]

  filters[5].framebuffer = null

  return (sourceTexture) => filters.reduce((prev, cur) => cur.post_filter(prev, sourceTexture), sourceTexture)
}

export function makeGlTexture(texture_id: number, texture_types: number | boolean, H: number, W: number, data?: Float32Array | null): WebGLTexture {
  const gl = ctx.gl
  const texture = gl.createTexture()!
  const maxUnits = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS) as number
  const unit = Math.min(Math.max(texture_id, 0), Math.max(maxUnits - 1, 0))
  gl.activeTexture(gl.TEXTURE0 + unit)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, texture_types ? gl.RG32F : gl.RGBA32F, H, W, 0, texture_types ? gl.RG : gl.RGBA, gl.FLOAT, data ?? null)
  return texture
}

export function setupFramebuffer(texture_id: number, texture_types: number | boolean, H: number, W: number): [WebGLTexture, WebGLFramebuffer] {
  const gl = ctx.gl
  const texture = makeGlTexture(texture_id, texture_types, H, W)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

  const framebuffer = gl.createFramebuffer()!
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)

  const depthBuffer = gl.createRenderbuffer()!
  gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer)
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, H, W)
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer)

  return [texture, framebuffer]
}

export class Light {
  position: Vector
  shadow_camera: Camera
  shadow: boolean
  dynamic_shadow?: boolean
  _texture: WebGLTexture
  brightness: number
  filter: Filter
  id: number
  private shadowDirty = true
  private lastShadowKey = ""

  constructor(position: Vector, theta: number, theta2: number, is_shadow?: boolean) {
    const N = 2048 >> ctx.graphics
    this.id = ctx.lightId++
    this.position = position
    this.shadow_camera = new Camera(position, [N, N], this.id ? 2.5 : 1, true, this.id, theta, theta2)
    this.shadow = !!is_shadow
    this._texture = this.shadow_camera._texture
    this.brightness = 2
    this.filter = new Filter(gaussian_2d, N / 2, N / 2, ctx.gl.RG)
  }

  markShadowDirty(): void {
    this.shadowDirty = true
  }

  compute_shadowmap(force = false): void {
    this.shadow_camera.position = this.position
    const key = `${this.position.x.toFixed(2)},${this.position.y.toFixed(2)},${this.position.z.toFixed(2)},${this.shadow_camera.theta.toFixed(3)},${this.shadow_camera.theta2.toFixed(3)}`
    if (!force && this.dynamic_shadow && !this.shadowDirty && key === this.lastShadowKey) {
      return
    }

    this.lastShadowKey = key
    this.shadowDirty = false

    const gl = ctx.gl
    gl.useProgram(ctx.program2)
    ctx.locations = ctx.locations2

    gl.activeTexture(gl.TEXTURE0 + this.id)
    gl.bindTexture(gl.TEXTURE_2D, this._texture)
    gl.uniform1i(ctx.locations.u_which_shadow_light as WebGLUniformLocation, this.id)

    this.shadow_camera.draw_scene()
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    this.filter.post_filter(this._texture)
  }
}

export function makeTexture(arr: number[]): void {
  const gl = ctx.gl
  const unit = 8 + ctx.allTextures.length
  ctx.allTextures.push(makeGlTexture(unit, 0, 256, 256, new Float32Array(arr)))
  gl.generateMipmap(gl.TEXTURE_2D)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  const anisoExt = gl.getExtension("EXT_texture_filter_anisotropic") || gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic")
  if (anisoExt) {
    const max = gl.getParameter(anisoExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number
    gl.texParameterf(gl.TEXTURE_2D, anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max))
  }
}

export function setupGraphics(): void {
  const gl = ctx.gl
  gl.getExtension("EXT_color_buffer_float")
  gl.getExtension("OES_texture_float_linear")

  ;[ctx.program1, ctx.locations1] = createProgram(gl, fragmentShaderHeader + program1Shader)
  ;[ctx.program2, ctx.locations2] = createProgram(gl, fragmentShaderHeader + `void main() {
    out_color.r = distance(u_light_position[u_which_shadow_light], world_position);
    out_color.g = out_color.r*out_color.r;
}
`,)

  const lerp = (x: number, y: number, r: number) => ((r = r * r * (3 - 2 * r)), x * (1 - r) + y * r)
  const random_points = range(16).map(() => range(16).map(() => newVector(Math.random() * 2 - 1, Math.random() * 2 - 1, 0).normalize()))

  const perlin_noise = cartesianProductMap(range(256), range(256), (y, x) => {
    y /= 16
    x /= 16
    const up_left = newVector(x | 0, y | 0, 0)
    let out = cartesianProductMap(range(2), range(2), (dy, dx) => random_points[(y + dy) & 15][(x + dx) & 15].dot(up_left.add(newVector(dx - x, dy - y, 0))),)

    out = lerp(
      lerp(out[0], out[1], x - up_left.x),
      lerp(out[2], out[3], x - up_left.x),
      y - up_left.y,
    ) as any

    return 2 * (out as unknown as number) + 0.2
  })

  const nAt = (x: number, y: number) => perlin_noise[((x & 255) * 256 + (y & 255))]

  makeTexture(perlin_noise.map((n) => {
    const v = 0.08 + n * 0.12
    return [v * 0.6, v * 0.85, v * 1.1, 1]
  }).flat())

  makeTexture(
    cartesianProductMap(range(256), range(256), (y, x) => {
      const n = nAt(x, y)
      const vein = Math.abs(Math.sin(x * 0.11 + n * 3) * Math.cos(y * 0.09 - n * 2))
      if (vein > 0.82) {
        return [0.35 + n * 0.4, 1.6, 0.25, 1]
      }

      const v = 0.04 + n * 0.08
      return [v * 0.5, v * 1.2, v * 0.4, 1]
    }).flat(),
  )

  makeTexture(
    cartesianProductMap(range(256), range(256), (y, x) => {
      const panel = 96
      const lx = x % panel
      const ly = y % panel
      const seam = lx < 3 || ly < 3 || lx > panel - 4 || ly > panel - 4
      const bolt = (lx > 8 && lx < 14 && ly > 8 && ly < 14) || (lx > panel - 14 && lx < panel - 8 && ly > panel - 14 && ly < panel - 8)
      const n = nAt(x * 2, y * 2)
      if (seam) {
        return [0.15, 0.85, 0.95, 1]
      }
      
      if (bolt) {
        return [0.55, 0.7, 0.8, 1]
      }

      const v = 0.14 + n * 0.06
      const stripe = ((x / 8) | 0) % 7 === 0 ? 0.04 : 0
      return [v * 0.55 + stripe, v * 0.7 + stripe, v * 0.95 + stripe * 1.4, 1]
    }).flat(),
  )

  makeTexture(
    cartesianProductMap(range(256), range(256), (y, x) => {
      const major = x % 64 < 2 || y % 64 < 2
      const minor = x % 16 < 1 || y % 16 < 1
      const n = nAt(x, y)
      if (major) {
        return [0.2, 1.1, 1.0, 1]
      }

      if (minor) {
        return [0.08, 0.35, 0.4, 1]
      }

      const v = 0.03 + n * 0.05
      return [v * 0.7, v * 0.85, v * 1.15, 1]
    }).flat(),
  )

  makeTexture(perlin_noise.map((n) => {
    const v = 0.2 + n * 0.35
    return [v * 0.55, v * 0.75, v * 1.05, 1]
  })
  .flat())
}
