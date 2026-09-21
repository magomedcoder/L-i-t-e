import type { GameObject } from "../entities/types"
import type { Camera, Light } from "../gfx/graphics"
import type { ShaderLocations } from "../gfx/types"
import type { Vector } from "../math/vector"
import type { Sprite } from "../mesh/sprite"
import type { GameMap } from "../map/map"

export type Chaingun = Sprite & { recoil: Vector }

export interface RenderState {
  gl: WebGL2RenderingContext
  camera: Camera
  realCamera: (tex: WebGLTexture) => WebGLTexture
  lights: Light[]
  cameraShake: number
  program1: WebGLProgram
  program2: WebGLProgram
  locations: ShaderLocations
  locations1: ShaderLocations
  locations2: ShaderLocations
  graphics: number
  globalScreenColor: number[]
  frame: number
  allTextures: WebGLTexture[]
  chaingun: Chaingun
  myBody: Sprite
}

export interface SessionState {
  map: GameMap
  objects: GameObject[]
  walls: GameObject[]
  canPlayMusic: boolean
  pageHasFocus: boolean
  endScreen: boolean
  difficulty: number
  lastNow: number
  moved: number
  lastGunshot: number
  speed: number
  jumpVelocity: number
  jumpHeld: boolean
  playerDead: number | false
  health: number
  goingBack: boolean
  lightIsHeld: boolean
  framecount: number
  minorBadness: number
  totalBadness: number
  lightId: number
  lastUserHit: number
}

export interface InputState {
  keys: Record<string, boolean>
}

export interface AudioState {
  sounds: Record<string, number[]>
  musicTimeouts: ReturnType<typeof setTimeout>[]
  musicNotes: number[][][] | null
}

export type GameContext = RenderState & SessionState & InputState & AudioState
