import type { Camera3D } from "./preview/camera3d"

export type CameraBookmark = {
  id: string
  name: string
  levelIndex: number
  camera: Pick<Camera3D, "target" | "distance" | "yaw" | "pitch" | "mode" | "eye" | "flyYaw" | "flyPitch">
}

const KEY = "mapeditor_camera_bookmarks"

export function loadBookmarks(mapId: string): CameraBookmark[] {
  try {
    const raw = localStorage.getItem(`${KEY}:${mapId}`)
    if (!raw) {
      return []
    }
    
    return JSON.parse(raw) as CameraBookmark[]
  } catch {
    return []
  }
}

export function saveBookmarks(mapId: string, list: CameraBookmark[]): void {
  localStorage.setItem(`${KEY}:${mapId}`, JSON.stringify(list))
}

export function addBookmark(mapId: string, levelIndex: number, name: string, camera: Camera3D): CameraBookmark[] {
  const list = loadBookmarks(mapId)
  list.push({
    id: `${Date.now()}`,
    name,
    levelIndex,
    camera: {
      target: { ...camera.target },
      distance: camera.distance,
      yaw: camera.yaw,
      pitch: camera.pitch,
      mode: camera.mode,
      eye: camera.eye ? { ...camera.eye } : null,
      flyYaw: camera.flyYaw,
      flyPitch: camera.flyPitch,
    },
  })
  saveBookmarks(mapId, list)
  return list
}

export function applyBookmark(camera: Camera3D, bm: CameraBookmark): void {
  camera.target = { ...bm.camera.target }
  camera.distance = bm.camera.distance
  camera.yaw = bm.camera.yaw
  camera.pitch = bm.camera.pitch
  camera.mode = bm.camera.mode
  camera.eye = bm.camera.eye ? { ...bm.camera.eye } : null
  camera.flyYaw = bm.camera.flyYaw
  camera.flyPitch = bm.camera.flyPitch
}

export function deleteBookmark(mapId: string, id: string): CameraBookmark[] {
  const list = loadBookmarks(mapId).filter((b) => b.id !== id)
  saveBookmarks(mapId, list)
  return list
}
