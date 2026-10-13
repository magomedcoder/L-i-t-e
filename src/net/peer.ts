import type { NetMsg, SignalPayload } from "./types"

const ICE: RTCConfiguration = {
  iceServers: [{ 
    urls: "stun:stun.l.google.com:19302" 
  }],
}

type PeerHandlers = {
  onMessage: (msg: NetMsg) => void
  onOpen: () => void
  onClose: () => void
  onSignal: (payload: SignalPayload) => void
}

export class GamePeer {
  private pc: RTCPeerConnection | null = null
  private channel: RTCDataChannel | null = null
  private handlers: PeerHandlers | null = null

  get connected(): boolean {
    return this.channel?.readyState === "open"
  }

  async startHost(handlers: PeerHandlers): Promise<void> {
    this.handlers = handlers
    this.setupPc()
    const channel = this.pc!.createDataChannel("game", { ordered: true })
    this.bindChannel(channel)
    const offer = await this.pc!.createOffer()
    await this.pc!.setLocalDescription(offer)
    handlers.onSignal({ kind: "offer", sdp: this.pc!.localDescription! })
  }

  async startGuest(handlers: PeerHandlers): Promise<void> {
    this.handlers = handlers
    this.setupPc()
  }

  async handleSignal(payload: SignalPayload): Promise<void> {
    if (!this.pc || !this.handlers) {
      return
    }

    if (payload.kind === "offer") {
      await this.pc.setRemoteDescription(payload.sdp)
      const answer = await this.pc.createAnswer()
      await this.pc.setLocalDescription(answer)
      this.handlers.onSignal({ kind: "answer", sdp: this.pc.localDescription! })
      return
    }

    if (payload.kind === "answer") {
      if (!this.pc.currentRemoteDescription) {
        await this.pc.setRemoteDescription(payload.sdp)
      }
      return
    }

    if (payload.kind === "ice" && payload.candidate) {
      try {
        await this.pc.addIceCandidate(payload.candidate)
      } catch {}
    }
  }

  send(msg: NetMsg): void {
    if (this.channel?.readyState === "open") {
      this.channel.send(JSON.stringify(msg))
    }
  }

  close(): void {
    this.channel?.close()
    this.pc?.close()
    this.channel = null
    this.pc = null
  }

  private setupPc(): void {
    this.close()
    this.pc = new RTCPeerConnection(ICE)
    this.pc.onicecandidate = (ev) => {
      if (!ev.candidate) {
        return
      }

      this.handlers?.onSignal({ kind: "ice", candidate: ev.candidate.toJSON() })
    }
    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState
      if (state === "failed" || state === "closed" || state === "disconnected") {
        this.handlers?.onClose()
      }
    }

    this.pc.ondatachannel = (ev) => this.bindChannel(ev.channel)
  }

  private bindChannel(channel: RTCDataChannel): void {
    this.channel = channel
    channel.binaryType = "arraybuffer"
    channel.onopen = () => this.handlers?.onOpen()
    channel.onclose = () => this.handlers?.onClose()
    channel.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as NetMsg
        this.handlers?.onMessage(msg)
      } catch {}
    }
  }
}
