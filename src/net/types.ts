export type NetRole = "host" | "guest"

export type SessionStatus = | "idle" | "connecting" | "waiting" | "signaling" | "connected" | "reconnecting" | "disconnected" | "error"

export type PoseMsg = {
  type: "pose"
  id: string
  x: number
  y: number
  z: number
  yaw: number
  pitch: number
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

export type NetMsg = PoseMsg | HelloMsg | ByeMsg | StartMsg

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
