import React, { useState, useEffect, useRef } from "react"
import socketIOClient from "socket.io-client"
import WebRTCManager from "./RTCManager"
const ENDPOINT = "http://127.0.0.1:5000"

function App() {
  const remoteLobbyVideos = useRef(null)
  const [presenterId, setPresenterId] = useState(null)
  const remoteVideo = useRef(null)
  const localLobbyVideo = useRef(null)
  const [participants, setParticipants] = useState({})
  const localVideo = useRef(null)
  const [socket, setSocket] = useState(null)

  useEffect(() => {
    let participants = {}

    const socket = socketIOClient(ENDPOINT)
    const manager = new WebRTCManager(socket, localVideo.current)
    const lobbyManager = new WebRTCManager(socket, localLobbyVideo.current)
    lobbyManager.prefix = "lobby-"
    const setPresenter = id => {
      setPresenterId(id)
      manager.presenterId = id
    }
    socket.on("add-participant", ({ socketId, participant }) => {
      participants[socketId] = participant
      setParticipants({ ...participants })

      if (participant) {
        if (participant.isPresenter) {
          setPresenter(socketId)
          lobbyManager.closeAllConnections()
          if (socketId !== socket.id) {
            socket.emit("request-offer", { to: socketId })
          }
        } else {
          if (socketId !== socket.id && !manager.presenterId) {
            socket.emit("request-offer-lobby", { to: socketId })
          }
        }
      }
    })
    socket.on("remove-participant", ({ socketId }) => {
      if (participants[socketId].isPresenter) setPresenter(null)
      delete participants[socketId]
      setParticipants({ ...participants })
    })
    socket.on("request-offer", manager.onRequestOffer.bind(manager))
    socket.on("request-offer-lobby", lobbyManager.onRequestOffer.bind(lobbyManager))
    socket.on("webrtc-offer", (args) => { manager.onOffer.call(manager, args, remoteVideo.current) })
    socket.on("lobby-webrtc-offer", (args) => {
      const videoElement = remoteLobbyVideos.current.querySelector(`#lobby-${args.from}`)
      lobbyManager.onOffer.call(lobbyManager, args, videoElement)
    })
    socket.on("webrtc-answer", manager.onAnswer.bind(manager))
    socket.on("lobby-webrtc-answer", lobbyManager.onAnswer.bind(lobbyManager))
    socket.on("webrtc-candidate", manager.onCandidate.bind(manager))
    socket.on("lobby-webrtc-candidate", lobbyManager.onCandidate.bind(lobbyManager))
    socket.on("webrtc-disconnect", manager.onDisconnect.bind(manager))
    socket.on("lobby-webrtc-disconnect", lobbyManager.onDisconnect.bind(lobbyManager))
    setSocket(socket)
    return () => socket.disconnect()
  }, [])

  const join = async isPresenter => {
    if (isPresenter)
      navigator.getUserMedia(
        { video: true, audio: true },
        stream => {
          if (localVideo.current) {
            localVideo.current.srcObject = stream
            socket.emit("join", isPresenter)
          }
        },
        (error) => { console.log(error) }
      )
    else
      navigator.getUserMedia(
        { video: true, audio: true },
        stream => {
          if (localVideo.current) {
            localVideo.current.srcObject = stream
            socket.emit("join", isPresenter)
          }
        },
        (error) => { console.log(error) }
      )
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <h1 style={{color: "#3d3d3d"}}>Video broadcast</h1>
      <p style={{color: "#3d3d3d"}}>{presenterId ? presenterId : "Nobody"} is presenting</p>
      {socket && participants[socket.id]
        ? (<button onClick={() => socket.emit("leave")} style={{ backgroundColor: " #24a0ed", border: 0, padding: "10px 20px", borderRadius: 5, color: "white" }}>leave</button>)
        : (<div><button style={{ backgroundColor: " #24a0ed", border: 0, padding: "10px 20px", borderRadius: 5, color: "white" }} onClick={() => { join(false) }}>join</button>
          {presenterId ? "" : (<button style={{ backgroundColor: " #f59b42", border: 0, padding: "10px 20px", borderRadius: 5, color: "white", marginLeft: 10 }} onClick={() => { join(true) }}>join as presenter</button>)}</div>)}
      <h2 style={{color: "#3d3d3d"}}>Participants</h2>
      <ul>
        {Object.entries(participants).map(([key, value]) => {
          return (<li key={key} style={{color: "#3d3d3d"}}>
            {value.name}{key === presenterId ? " (Presenter)" : ""}
          </li>)
        })}
      </ul>
      <div style={{ display: "flex", flexDirection: "row" }}>
        <div>
          <h2 style={{color: "#3d3d3d"}}>LOCAL</h2>
          <video ref={localVideo} autoPlay muted style={{ border: "4px solid #f59b42", borderRadius: 10, width: 250, height: 150 }} />
        </div>
        <div style={{ marginLeft: 20}}>
          <h2 style={{color: "#3d3d3d"}}>REMOTE</h2>
          <video ref={remoteVideo} autoPlay muted style={{ border: "4px solid #1cc4d6", borderRadius: 10, width: 250, height: 150 }} />
        </div>
      </div>
      <div ref={remoteLobbyVideos} style={{marginTop: 20}}>
        <video ref={localLobbyVideo} autoPlay muted style={{ border: "4px solid #f59b42", width: 250, height: 150, borderRadius: 10 }} />
        {Object.keys(participants).filter(socketId => socketId !== socket.id).map(socketId => {
          return (<video key={socketId} id={`lobby-${socketId}`} autoPlay style={{ border: "4px solid #1cc4d6", width: 250, height: 150, borderRadius: 10, marginLeft:20 }} />)
        })}
      </div>
    </div>
  )
}

export default App