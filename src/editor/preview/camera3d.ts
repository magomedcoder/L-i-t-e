import type { Vec3 } from "./meshBuild"

export type Camera3D = {
  target: Vec3
  distance: number
  yaw: number
  pitch: number
  fov: number
  eye: Vec3 | null
  flyYaw: number
  flyPitch: number
  mode: "orbit" | "fly"
}

export function createCamera3D(): Camera3D {
  return {
    target: { x: 0, y: 0, z: 16 },
    distance: 180,
    yaw: 0.8,
    pitch: 0.55,
    fov: Math.PI / 3,
    eye: null,
    flyYaw: 0.8,
    flyPitch: 0.2,
    mode: "orbit",
  }
}

export function cameraEye(cam: Camera3D): Vec3 {
  if (cam.mode === "fly" && cam.eye) {
    return cam.eye
  }

  const cp = Math.cos(cam.pitch)
  return {
    x: cam.target.x + Math.sin(cam.yaw) * cp * cam.distance,
    y: cam.target.y + Math.cos(cam.yaw) * cp * cam.distance,
    z: cam.target.z + Math.sin(cam.pitch) * cam.distance,
  }
}

export function focusBounds(cam: Camera3D, min: Vec3, max: Vec3): void {
  cam.target = {
    x: (min.x + max.x) / 2,
    y: (min.y + max.y) / 2,
    z: (min.z + max.z) / 2,
  }
  const dx = max.x - min.x
  const dy = max.y - min.y
  const dz = max.z - min.z
  const radius = Math.max(40, Math.sqrt(dx * dx + dy * dy + dz * dz) * 0.65)
  cam.distance = radius
  cam.mode = "orbit"
  cam.eye = null
}

export function orbitDrag(cam: Camera3D, dx: number, dy: number): void {
  cam.yaw -= dx * 0.008
  cam.pitch = Math.max(0.05, Math.min(1.45, cam.pitch + dy * 0.008))
}

export function flyLook(cam: Camera3D, dx: number, dy: number): void {
  cam.flyYaw -= dx * 0.004
  cam.flyPitch = Math.max(-1.4, Math.min(1.4, cam.flyPitch - dy * 0.004))
}

export function flyMove(cam: Camera3D, forward: number, right: number, up: number, dt: number): void {
  if (!cam.eye) {
    cam.eye = cameraEye(cam)
    cam.mode = "fly"
  }
  const speed = 80 * dt
  const cy = Math.cos(cam.flyYaw)
  const sy = Math.sin(cam.flyYaw)
  const cp = Math.cos(cam.flyPitch)
  const sp = Math.sin(cam.flyPitch)
  const fx = sy * cp
  const fy = cy * cp
  const fz = sp
  const rx = cy
  const ry = -sy
  cam.eye.x += (fx * forward + rx * right) * speed
  cam.eye.y += (fy * forward + ry * right) * speed
  cam.eye.z += (fz * forward + up) * speed
}

export function zoomCamera(cam: Camera3D, delta: number): void {
  if (cam.mode === "fly" && cam.eye) {
    const f = delta > 0 ? -8 : 8
    flyMove(cam, f, 0, 0, 0.05)
    return
  }
  cam.distance = Math.max(20, Math.min(2000, cam.distance * (delta > 0 ? 1.12 : 0.9)))
}

export function makeViewProj(cam: Camera3D, aspect: number): Float32Array {
  const eye = cameraEye(cam)
  const target = cam.mode === "fly"
    ? {
        x: eye.x + Math.sin(cam.flyYaw) * Math.cos(cam.flyPitch),
        y: eye.y + Math.cos(cam.flyYaw) * Math.cos(cam.flyPitch),
        z: eye.z + Math.sin(cam.flyPitch),
      }
    : cam.target

  const view = lookAt(eye, target, { x: 0, y: 0, z: 1 })
  const proj = perspective(cam.fov, aspect, 1, 5000)
  return multiply4(proj, view)
}

function lookAt(eye: Vec3, center: Vec3, up: Vec3): Float32Array {
  let zx = eye.x - center.x
  let zy = eye.y - center.y
  let zz = eye.z - center.z
  let zl = Math.hypot(zx, zy, zz) || 1
  zx /= zl
  zy /= zl
  zz /= zl
  let xx = up.y * zz - up.z * zy
  let xy = up.z * zx - up.x * zz
  let xz = up.x * zy - up.y * zx
  let xl = Math.hypot(xx, xy, xz) || 1
  xx /= xl
  xy /= xl
  xz /= xl
  const yx = zy * xz - zz * xy
  const yy = zz * xx - zx * xz
  const yz = zx * xy - zy * xx
  const out = new Float32Array(16)
  out[0] = xx
  out[1] = yx
  out[2] = zx
  out[3] = 0
  out[4] = xy
  out[5] = yy
  out[6] = zy
  out[7] = 0
  out[8] = xz
  out[9] = yz
  out[10] = zz
  out[11] = 0
  out[12] = -(xx * eye.x + xy * eye.y + xz * eye.z)
  out[13] = -(yx * eye.x + yy * eye.y + yz * eye.z)
  out[14] = -(zx * eye.x + zy * eye.y + zz * eye.z)
  out[15] = 1
  return out
}

function perspective(fov: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1 / Math.tan(fov / 2)
  const out = new Float32Array(16)
  out[0] = f / aspect
  out[5] = f
  out[10] = (far + near) / (near - far)
  out[11] = -1
  out[14] = (2 * far * near) / (near - far)
  return out
}

function multiply4(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16)
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      out[col * 4 + row] = a[0 * 4 + row] * b[col * 4 + 0] + a[1 * 4 + row] * b[col * 4 + 1] + a[2 * 4 + row] * b[col * 4 + 2] + a[3 * 4 + row] * b[col * 4 + 3]
    }
  }

  return out
}

export function projectPoint(mvp: Float32Array, p: Vec3, width: number, height: number): { x: number; y: number; z: number; clipW: number } | null {
  const x = mvp[0] * p.x + mvp[4] * p.y + mvp[8] * p.z + mvp[12]
  const y = mvp[1] * p.x + mvp[5] * p.y + mvp[9] * p.z + mvp[13]
  const z = mvp[2] * p.x + mvp[6] * p.y + mvp[10] * p.z + mvp[14]
  const w = mvp[3] * p.x + mvp[7] * p.y + mvp[11] * p.z + mvp[15]
  if (w === 0) {
    return null
  }

  const ndcX = x / w
  const ndcY = y / w
  const ndcZ = z / w
  return {
    x: (ndcX * 0.5 + 0.5) * width,
    y: (1 - (ndcY * 0.5 + 0.5)) * height,
    z: ndcZ,
    clipW: w,
  }
}
