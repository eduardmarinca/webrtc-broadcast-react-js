// Handles WebRTC connections between a presenter that broadcasts to spectators
export default class WebRTCManager {
    constructor(socket, localVideo) {
        this.socket = socket
        this.localVideo = localVideo

        this.prefix = ""

        this.peerConnections = {}
        this.elements = {}
        this.presenterId = null
        this.config = {
            iceServers: [
                {
                    urls: ["stun:stun.l.google.com:19302"]
                }
            ]
        }
    }

    async onCandidate({ candidate, from }) {
        this.peerConnections[from].addIceCandidate(new RTCIceCandidate(candidate))
    }
    createPeerConnection(socketId) {
        const pc = new RTCPeerConnection(this.config)
        pc.onicecandidate = event => {
            if (event.candidate)
                this.socket.emit(`${this.prefix}webrtc-candidate`, { to: socketId, candidate: event.candidate })
        }

        this.peerConnections[socketId] = pc
        return pc
    }

    onRequestOffer(socketId) {
        this.sendOffer(socketId)
    }

    async sendOffer(socketId) {
        const pc = this.createPeerConnection(socketId)

        const stream = this.localVideo.srcObject
        stream?.getTracks().forEach(track => pc.addTrack(track, stream))

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        this.socket.emit(`${this.prefix}webrtc-offer`, { offer: pc.localDescription, to: socketId })
    }

    async onAnswer({ answer, from }) {
        const pc = this.peerConnections[from]
        await pc.setRemoteDescription(new RTCSessionDescription(answer))
    }

    onDisconnect({ from }) {
        this.closeConnection(from)
    }

    closeConnection(socketId) {
        if (this.peerConnections[socketId]) {
            this.peerConnections[socketId].close()
            if (this.elements[socketId])
                this.elements[socketId].srcObject = undefined
            delete this.peerConnections[socketId]
        }
    }

    closeAllConnections() {
        Object.keys(this.peerConnections).forEach(socketId => {
            this.closeConnection(socketId)
        })
    }

    async onOffer({ offer, from }, mediaElement) {
        const pc = this.createPeerConnection(from)
        this.elements[from] = mediaElement
        pc.ontrack = ({ streams: [stream] }) => {
            if (this.elements[from]) this.elements[from].srcObject = stream
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(new RTCSessionDescription(answer))

        this.socket.emit(`${this.prefix}webrtc-answer`, { answer, to: from })
    }
}