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

    // Handles ICE candidate exchange
    async onCandidate({ candidate, from }) {
        this.peerConnections[from].addIceCandidate(new RTCIceCandidate(candidate))
    }

    // Creates Peer connection and associates it with a socket
    createPeerConnection(socketId) {
        const pc = new RTCPeerConnection(this.config)
        pc.onicecandidate = event => {
            if (event.candidate)
                this.socket.emit(`${this.prefix}webrtc-candidate`, { to: socketId, candidate: event.candidate })
        }

        this.peerConnections[socketId] = pc
        return pc
    }

    // Creates a peer connection offer and emits it to connected clients
    onRequestOffer(socketId) {
        this.sendOffer(socketId)
    }

    async sendOffer(socketId) {
        const pc = this.createPeerConnection(socketId)

        const stream = this.localVideo.srcObject
        stream.getTracks().forEach(track => pc.addTrack(track, stream))

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        this.socket.emit(`${this.prefix}webrtc-offer`, { offer: pc.localDescription, to: socketId })
    }

    // Handles clients' answers to the offer that was previously sent
    async onAnswer({ answer, from }) {
        const pc = this.peerConnections[from]
        await pc.setRemoteDescription(new RTCSessionDescription(answer))
    }

    // Disconnects peer connection
    onDisconnect({ from }) {
        this.closeConnection(from)
    }

    // Closes a single peer connection
    closeConnection(socketId) {
        if (this.peerConnections[socketId]) {
            this.peerConnections[socketId].close()
            if (this.elements[socketId])
                this.elements[socketId].srcObject = undefined
            delete this.peerConnections[socketId]
        }
    }

    // Closes all peer connections
    closeAllConnections() {
        Object.keys(this.peerConnections).forEach(socketId => {
            this.closeConnection(socketId)
        })
    }

    // Handles incoming offer and serts up peer connection on the spectator side
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