import type { Plugin, ViteDevServer } from "vite"
import type { IncomingMessage } from "node:http"
import { WebSocketServer, type WebSocket } from "ws"

type Role = "host" | "guest"

type Client = {
  ws: WebSocket
  room: string | null
  role: Role | null
}

type SignalMsg = {
  type: string
  room?: string
  payload?: unknown
  reason?: string
}

const PATH = "/__lan_signal"

function roomCode(): string {
  let out = ""
  for (let i = 0; i < 4; i++) {
    out += String((Math.random() * 10) | 0)
  }
  
  return out
}

function send(ws: WebSocket, msg: SignalMsg): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg))
  }
}

function attachSignal(server: ViteDevServer["httpServer"]): void {
  if (!server || (server as { __lanSignalAttached?: boolean }).__lanSignalAttached) {
    return
  }

  ;(server as { __lanSignalAttached?: boolean }).__lanSignalAttached = true

  const wss = new WebSocketServer({ noServer: true })
  const clients = new Map<WebSocket, Client>()
  const rooms = new Map<string, { host: WebSocket | null; guest: WebSocket | null }>()

  const peerOf = (client: Client): WebSocket | null => {
    if (!client.room) {
      return null
    }

    const room = rooms.get(client.room)
    if (!room) {
      return null
    }

    return client.role === "host" ? room.guest : room.host
  }

  const leave = (ws: WebSocket): void => {
    const client = clients.get(ws)
    if (!client?.room) {
      clients.delete(ws)
      return
    }

    const room = rooms.get(client.room)
    if (room) {
      if (client.role === "host") {
        room.host = null
      } else {
        room.guest = null
      }

      const other = client.role === "host" ? room.guest : room.host
      if (other) {
        send(other, { 
          type: "peer-left", 
          room: client.room 
        })
      }

      if (!room.host && !room.guest) {
        rooms.delete(client.room)
      }
    }
    client.room = null
    client.role = null
    clients.delete(ws)
  }

  server.on("upgrade", (req: IncomingMessage, socket, head) => {
    const url = req.url || ""
    if (!url.startsWith(PATH)) {
      return
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req)
    })
  })

  wss.on("connection", (ws: WebSocket) => {
    clients.set(ws, { ws, room: null, role: null })

    ws.on("message", (raw) => {
      let msg: SignalMsg
      try {
        msg = JSON.parse(String(raw)) as SignalMsg
      } catch {
        return
      }

      const client = clients.get(ws)
      if (!client) {
        return
      }

      if (msg.type === "create") {
        leave(ws)
        let code = (msg.room || "").toUpperCase()
        if (code) {
          const existing = rooms.get(code)
          if (existing?.host && existing.host !== ws) {
            send(ws, { 
              type: "error", 
              reason: "room-taken" 
            })
            return
          }

          rooms.set(code, { 
            host: ws, 
            guest: existing?.guest ?? null 
          })
        } else {
          code = roomCode()
          while (rooms.has(code)) {
            code = roomCode()
          }
          rooms.set(code, { 
            host: ws, 
            guest: null 
          })
        }
        client.room = code
        client.role = "host"
        clients.set(ws, client)
        send(ws, { type: "created", room: code })
        const room = rooms.get(code)
        if (room?.guest) {
          send(ws, { type: "peer-joined", room: code })
          send(room.guest, { 
            type: "peer-joined", 
            room: code 
          })
        }
        return
      }

      if (msg.type === "join" && msg.room) {
        const code = msg.room.toUpperCase()
        const room = rooms.get(code)
        if (!room || !room.host) {
          send(ws, { 
            type: "error", 
            reason: "room-missing" 
          })
          return
        }
        if (room.guest) {
          send(ws, { 
            type: "error", 
            reason: "room-full" 
          })
          return
        }
        leave(ws)
        room.guest = ws
        client.room = code
        client.role = "guest"
        clients.set(ws, client)
        send(ws, { type: "joined", room: code })
        send(room.host, { 
          type: "peer-joined", 
          room: code 
        })
        return
      }

      if (msg.type === "signal" && client.room) {
        const other = peerOf(client)
        if (other) {
          send(other, { 
            type: "signal", 
            room: client.room, 
            payload: msg.payload 
          })
        }
        return
      }

      if (msg.type === "leave") {
        leave(ws)
      }
    })

    ws.on("close", () => leave(ws))
    ws.on("error", () => leave(ws))
  })
}

export function lanSignalPlugin(): Plugin {
  return {
    name: "lan-signal",
    configureServer(server) {
      attachSignal(server.httpServer)
    },
    configurePreviewServer(server) {
      attachSignal(server.httpServer)
    },
  }
}
