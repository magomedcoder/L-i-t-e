import type { SignalPayload } from "./types"

type Handlers = {
  onCreated?: (room: string) => void
  onJoined?: (room: string) => void
  onPeerJoined?: () => void
  onPeerLeft?: () => void
  onSignal?: (payload: SignalPayload) => void
  onError?: (reason: string) => void
  onClose?: () => void
}

function signalUrl(): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:"
  return `${proto}//${location.host}/__lan_signal`
}

export class SignalingClient {
  private ws: WebSocket | null = null
  private handlers: Handlers = {}

  connect(handlers: Handlers): Promise<void> {
    this.handlers = handlers
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(signalUrl())
      this.ws = ws
      ws.addEventListener("open", () => resolve())
      ws.addEventListener("error", () => reject(new Error("signaling-failed")))
      ws.addEventListener("close", () => this.handlers.onClose?.())
      ws.addEventListener("message", (ev) => {
        let msg: { type: string; room?: string; payload?: SignalPayload; reason?: string }
        try {
          msg = JSON.parse(String(ev.data))
        } catch {
          return
        }

        if (msg.type === "created" && msg.room) {
          this.handlers.onCreated?.(msg.room)
        }

        if (msg.type === "joined" && msg.room) {
          this.handlers.onJoined?.(msg.room)
        }

        if (msg.type === "peer-joined") {
          this.handlers.onPeerJoined?.()
        }

        if (msg.type === "peer-left") {
          this.handlers.onPeerLeft?.()
        }

        if (msg.type === "signal" && msg.payload) {
          this.handlers.onSignal?.(msg.payload)
        }

        if (msg.type === "error") {
          this.handlers.onError?.(msg.reason || "error")
        }
      })
    })
  }

  create(room?: string): void {
    this.send(room ? { type: "create", room } : { type: "create" })
  }

  join(room: string): void {
    this.send({ type: "join", room: room.toUpperCase() })
  }

  signal(payload: SignalPayload): void {
    this.send({ type: "signal", payload })
  }

  leave(): void {
    this.send({ type: "leave" })
    this.ws?.close()
    this.ws = null
  }

  private send(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }
}
