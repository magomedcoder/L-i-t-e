import { SignalingClient } from "./signaling"
import { GamePeer } from "./peer"
import { clearRemotePlayers, pruneStaleRemotes, removeRemotePlayer, upsertRemotePlayer } from "./remotePlayer"
import type { NetMsg, NetRole, PoseMsg, SessionSnapshot, SessionStatus } from "./types"

const STORAGE_KEY = "lite_mp_session"

type StoredSession = {
  room: string
  role: NetRole
  peerId: string
}

type SessionListeners = {
  onChange?: (snap: SessionSnapshot) => void
  onStartGame?: (mapId: string) => void
}

function newPeerId(): string {
  return crypto.randomUUID().slice(0, 8)
}

function loadStored(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredSession) : null
  } catch {
    return null
  }
}

function saveStored(data: StoredSession | null): void {
  if (!data) {
    sessionStorage.removeItem(STORAGE_KEY)
    return
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

async function gameplay() {
  return import("./gameplay")
}

class MultiplayerSession {
  private signaling = new SignalingClient()
  private peer = new GamePeer()
  private status: SessionStatus = "idle"
  private role: NetRole | null = null
  private room: string | null = null
  private peerId = newPeerId()
  private remoteId: string | null = null
  private error: string | null = null
  private listeners: SessionListeners = {}
  private lastPoseAt = 0
  private mapId: string | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private intentionalClose = false

  get snapshot(): SessionSnapshot {
    return {
      status: this.status,
      role: this.role,
      room: this.room,
      peerId: this.peerId,
      remoteId: this.remoteId,
      error: this.error,
      shareUrl: this.room ? `${location.origin}${location.pathname}?room=${this.room}` : null,
    }
  }

  get ready(): boolean {
    return this.status === "connected" && this.peer.connected
  }

  subscribe(listeners: SessionListeners): void {
    this.listeners = listeners
  }

  send(msg: NetMsg): void {
    if (this.ready) {
      this.peer.send(msg)
    }
  }

  async createRoom(mapId: string, preferredRoom?: string): Promise<void> {
    this.intentionalClose = false
    this.mapId = mapId
    this.setStatus("connecting")
    await this.signaling.connect(this.signalHandlers())
    this.role = "host"
    this.signaling.create(preferredRoom)
  }

  async joinRoom(room: string, mapId: string): Promise<void> {
    this.intentionalClose = false
    this.mapId = mapId
    this.room = room.toUpperCase()
    this.role = "guest"
    this.setStatus("connecting")
    await this.signaling.connect(this.signalHandlers())
    await this.peer.startGuest(this.peerHandlers())
    this.signaling.join(this.room)
  }

  async tryRestore(mapId: string): Promise<boolean> {
    const stored = loadStored()
    if (!stored) {
      return false
    }
    this.peerId = stored.peerId
    this.mapId = mapId
    try {
      if (stored.role === "host") {
        await this.createRoom(mapId, stored.room)
      } else {
        await this.joinRoom(stored.room, mapId)
      }
      return true
    } catch {
      this.setError("reconnect-failed")
      return false
    }
  }

  disconnect(): void {
    this.intentionalClose = true
    this.clearReconnect()
    this.peer.send({ type: "bye", id: this.peerId })
    this.peer.close()
    this.signaling.leave()
    clearRemotePlayers()
    this.remoteId = null
    this.room = null
    this.role = null
    saveStored(null)
    this.setStatus("idle")
  }

  requestStart(mapId: string): void {
    this.mapId = mapId
    this.send({ type: "start", mapId })
  }

  tickPose(pose: Omit<PoseMsg, "type" | "id">): void {
    if (!this.ready) {
      return
    }
    const now = performance.now()
    if (now - this.lastPoseAt < 50) {
      return
    }
    this.lastPoseAt = now
    this.send({ type: "pose", id: this.peerId, ...pose })
    pruneStaleRemotes()
  }

  private signalHandlers() {
    return {
      onCreated: (room: string) => {
        this.room = room
        this.role = "host"
        saveStored({ room, role: "host", peerId: this.peerId })
        this.setStatus("waiting")
      },
      onJoined: (room: string) => {
        this.room = room
        this.role = "guest"
        saveStored({ room, role: "guest", peerId: this.peerId })
        this.setStatus("signaling")
      },
      onPeerJoined: () => {
        void this.peer.startHost(this.peerHandlers()).catch((err) => {
          this.setError(String(err))
        })
        this.setStatus("signaling")
      },
      onPeerLeft: () => {
        this.remoteId = null
        clearRemotePlayers()
        this.peer.close()
        if (this.role === "host") {
          this.setStatus("waiting")
        } else {
          this.scheduleReconnect()
        }
      },
      onSignal: (payload) => {
        void this.peer.handleSignal(payload)
      },
      onError: (reason: string) => this.setError(reason),
      onClose: () => {
        if (!this.intentionalClose && this.room) {
          this.scheduleReconnect()
        }
      },
    }
  }

  private peerHandlers() {
    return {
      onOpen: () => {
        this.send({ 
          type: "hello", 
          id: this.peerId, 
          mapId: this.mapId || undefined 
        })
        this.setStatus("connected")
      },
      onClose: () => {
        if (this.intentionalClose) {
          return
        }
        this.scheduleReconnect()
      },
      onMessage: (msg: NetMsg) => this.onNetMsg(msg),
      onSignal: (payload) => this.signaling.signal(payload),
    }
  }

  private onNetMsg(msg: NetMsg): void {
    if (msg.type === "hello") {
      this.remoteId = msg.id
      this.emit()
      return
    }

    if (msg.type === "pose") {
      this.remoteId = msg.id
      upsertRemotePlayer( msg.id, msg.x, msg.y, msg.z, msg.yaw, msg.pitch, !!msg.jump, !!msg.fire, msg.health ?? 5)
      return
    }

    if (msg.type === "bye") {
      removeRemotePlayer(msg.id)
      this.remoteId = null
      this.emit()
      return
    }

    if (msg.type === "start") {
      this.listeners.onStartGame?.(msg.mapId)
      return
    }

    void gameplay().then((gp) => {
      if (msg.type === "shoot") {
        gp.applyRemoteShoot(msg)
      } else if (msg.type === "hurt") {
        gp.applyRemoteHurt(msg.id, msg.health)
      } else if (msg.type === "death") {
        gp.applyRemoteDeath(msg.id)
      } else if (msg.type === "respawn") {
        gp.applyRemoteRespawn(msg.id, msg.x, msg.y, msg.z, msg.health)
      } else if (msg.type === "collect") {
        gp.applyNetworkCollect(msg)
      } else if (msg.type === "collect-req") {
        gp.hostHandleCollectReq(msg.kind, msg.uid, msg.x, msg.y, msg.z)
      } else if (msg.type === "level") {
        gp.applyNetworkLevel(msg)
      }
    })
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose) {
      return
    }

    const stored = loadStored()
    if (!stored) {
      this.setStatus("disconnected")
      return
    }

    this.setStatus("reconnecting")
    this.clearReconnect()
    this.reconnectTimer = setTimeout(() => {
      void this.tryRestore(this.mapId || "").then((ok) => {
        if (!ok) {
          this.setStatus("disconnected")
        }
      })
    }, 1200)
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private setStatus(status: SessionStatus): void {
    this.status = status
    if (status !== "error") {
      this.error = null
    }
    this.emit()
  }

  private setError(reason: string): void {
    this.error = reason
    this.status = "error"
    this.emit()
  }

  private emit(): void {
    this.listeners.onChange?.(this.snapshot)
  }
}

export const mpSession = new MultiplayerSession()
