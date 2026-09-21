import type { LevelData } from "../../map/levelFormat"
import type { Camera3D } from "./camera3d"
import { makeViewProj, projectPoint } from "./camera3d"
import { buildPreviewMesh, type MeshBuildOptions, type PreviewMesh, type Tri } from "./meshBuild"

const VS = `#version 300 es
in vec3 a_pos;
in vec4 a_col;
uniform mat4 u_mvp;
out vec4 v_col;
void main() {
  v_col = a_col;
  gl_Position = u_mvp * vec4(a_pos, 1.0);
}`

const FS = `#version 300 es
precision mediump float;
in vec4 v_col;
out vec4 outColor;
void main() {
  outColor = v_col;
}`

export type PreviewRenderer = {
  canvas: HTMLCanvasElement
  gl: WebGL2RenderingContext
  camera: Camera3D
  mesh: PreviewMesh | null
  fps: number
  dispose: () => void
  resize: () => void
  setMesh: (mesh: PreviewMesh) => void
  rebuildFromLevel: (level: LevelData, opts: MeshBuildOptions) => void
  render: () => void
  screenToCanvas: (clientX: number, clientY: number) => {
    x: number
    y: number
    w: number
    h: number
  }
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) || "shader compile failed")
  }

  return sh
}

function link(gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram {
  const p = gl.createProgram()!
  gl.attachShader(p, vs)
  gl.attachShader(p, fs)
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p) || "program link failed")
  }
  
  return p
}

function packMesh(mesh: PreviewMesh): { positions: Float32Array; colors: Float32Array; count: number } {
  const n = mesh.tris.length * 3
  const positions = new Float32Array(n * 3)
  const colors = new Float32Array(n * 4)
  let pi = 0
  let ci = 0
  const push = (t: Tri, p: { x: number; y: number; z: number }) => {
    positions[pi++] = p.x
    positions[pi++] = p.y
    positions[pi++] = p.z
    colors[ci++] = t.color[0]
    colors[ci++] = t.color[1]
    colors[ci++] = t.color[2]
    colors[ci++] = t.color[3]
  }

  for (const t of mesh.tris) {
    push(t, t.a)
    push(t, t.b)
    push(t, t.c)
  }

  return { positions, colors, count: n }
}

export function createPreviewRenderer(canvas: HTMLCanvasElement, camera: Camera3D): PreviewRenderer {
  const gl = canvas.getContext("webgl2", {
    antialias: true,
    alpha: false,
    depth: true,
    powerPreference: "low-power",
  })
  if (!gl) {
    throw new Error("WebGL2 unavailable for editor preview")
  }

  const program = link(gl, compile(gl, gl.VERTEX_SHADER, VS), compile(gl, gl.FRAGMENT_SHADER, FS))
  const locPos = gl.getAttribLocation(program, "a_pos")
  const locCol = gl.getAttribLocation(program, "a_col")
  const locMvp = gl.getUniformLocation(program, "u_mvp")

  const vao = gl.createVertexArray()!
  const bufPos = gl.createBuffer()!
  const bufCol = gl.createBuffer()!
  let vertCount = 0
  let mesh: PreviewMesh | null = null

  let frames = 0
  let fps = 0
  let fpsT = performance.now()

  const upload = (m: PreviewMesh) => {
    mesh = m
    let tris = m.tris
    const MAX = 120_000
    if (tris.length > MAX) {
      const step = Math.ceil(tris.length / MAX)
      tris = tris.filter((_, i) => i % step === 0)
      mesh = { tris, bounds: m.bounds }
    }

    const packed = packMesh(mesh)
    vertCount = packed.count
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, bufPos)
    gl.bufferData(gl.ARRAY_BUFFER, packed.positions, gl.DYNAMIC_DRAW)
    gl.enableVertexAttribArray(locPos)
    gl.vertexAttribPointer(locPos, 3, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, bufCol)
    gl.bufferData(gl.ARRAY_BUFFER, packed.colors, gl.DYNAMIC_DRAW)
    gl.enableVertexAttribArray(locCol)
    gl.vertexAttribPointer(locCol, 4, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)
  }

  const resize = () => {
    const dpr = Math.min(devicePixelRatio, 1.5)
    const w = Math.max(1, canvas.clientWidth)
    const h = Math.max(1, canvas.clientHeight)
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    gl.viewport(0, 0, canvas.width, canvas.height)
  }

  const render = () => {
    resize()
    gl.enable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.clearColor(0.05, 0.06, 0.09, 1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    if (!vertCount) {
      return
    }

    const aspect = canvas.width / Math.max(1, canvas.height)
    const mvp = makeViewProj(camera, aspect)
    gl.useProgram(program)
    gl.uniformMatrix4fv(locMvp, false, mvp)
    gl.bindVertexArray(vao)
    gl.drawArrays(gl.TRIANGLES, 0, vertCount)
    gl.bindVertexArray(null)

    frames++
    const now = performance.now()
    if (now - fpsT >= 500) {
      fps = Math.round((frames * 1000) / (now - fpsT))
      frames = 0
      fpsT = now
    }
  }

  return {
    canvas,
    gl,
    camera,
    get mesh() {
      return mesh
    },
    set mesh(v) {
      mesh = v
    },
    get fps() {
      return fps
    },
    dispose: () => {
      gl.deleteBuffer(bufPos)
      gl.deleteBuffer(bufCol)
      gl.deleteVertexArray(vao)
      gl.deleteProgram(program)
    },
    resize,
    setMesh: upload,
    rebuildFromLevel: (level, opts) => {
      upload(buildPreviewMesh(level, opts))
    },
    render,
    screenToCanvas: (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect()
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
        w: rect.width,
        h: rect.height,
      }
    },
  }
}

export function drawOverlay2d(
  ctx: CanvasRenderingContext2D,
  camera: Camera3D,
  width: number,
  height: number,
  labels: { text: string; world: { x: number; y: number; z: number }; color?: string }[],
): void {
  ctx.clearRect(0, 0, width, height)
  const aspect = width / Math.max(1, height)
  const mvp = makeViewProj(camera, aspect)
  ctx.font = "11px monospace"
  for (const label of labels) {
    const p = projectPoint(mvp, label.world, width, height)
    if (!p || p.clipW <= 0 || p.z < -1 || p.z > 1) {
      continue
    }
    
    ctx.fillStyle = label.color || "#ffe08a"
    ctx.fillText(label.text, p.x, p.y)
  }
}
