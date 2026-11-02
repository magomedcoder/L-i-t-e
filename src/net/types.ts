export type NetRole = "host" | "guest"

export type SessionStatus = | "idle" | "connecting" | "waiting" | "signaling" | "connected" | "reconnecting" | "disconnected" | "error"

export type CollectKind = "goal" | "health" | "flashlight" | "exit"

export type PoseMsg = {
  type: "pose"
  id: string
  x: number
  y: number
  z: number
  yaw: number
  pitch: number
  jump: number
  fire: number
  health: number
}

export type HelloMsg = {
  type: "hello"
  id: string
  mapId?: string
}

export type ByeMsg = {
  type: "bye"
  id: string
}

export type StartMsg = {
  type: "start"
  mapId: string
}

export type ShootMsg = {
  type: "shoot"
  id: string
  ox: number
  oy: number
  oz: number
  fx: number
  fy: number
  fz: number
}

export type HurtMsg = {
  type: "hurt"
  id: string
  health: number
}

export type DeathMsg = {
  type: "death"
  id: string
}

export type RespawnMsg = {
  type: "respawn"
  id: string
  x: number
  y: number
  z: number
  health: number
}

export type CollectMsg = {
  type: "collect"
  kind: CollectKind
  uid: number
  x: number
  y: number
  z: number
}

export type CollectReqMsg = {
  type: "collect-req"
  kind: CollectKind
  uid: number
  x: number
  y: number
  z: number
}

export type LevelMsg = {
  type: "level"
  action: "next" | "reset" | "end"
}

export type NetMsg = | PoseMsg | HelloMsg | ByeMsg | StartMsg | ShootMsg | HurtMsg | DeathMsg | RespawnMsg | CollectMsg | CollectReqMsg | LevelMsg

export type SignalPayload = | { 
    kind: "offer"
    sdp: RTCSessionDescriptionInit
  } | { 
    kind: "answer"
    sdp: RTCSessionDescriptionInit
  } | { 
    kind: "ice"
    candidate: RTCIceCandidateInit | null
  }

export type SessionSnapshot = {
  status: SessionStatus
  role: NetRole | null
  room: string | null
  peerId: string
  remoteId: string | null
  error: string | null
  shareUrl: string | null
}
