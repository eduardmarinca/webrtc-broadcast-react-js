import React, { useState, useEffect, useRef } from "react"
import socketIOClient from "socket.io-client"
import WebRTCManager from "./WebRTCManager"
const ENDPOINT = "http://127.0.0.1:4001"

function App() {
  const [presenterId, setPresenterId] = useState(null)
  const [socket, setSocket] = useState(null)
  const [participants, setParticipants] = useState({})
  const localVideo = useRef(null)
  const remoteVideo = useRef(null)
  const localLobbyVideo = useRef(null)
  const remoteLobbyVideos = useRef(null)

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
          // if a presenter joins, close all lobby connections and request an offer from the presenter
          setPresenter(socketId)
          lobbyManager.closeAllConnections()
          if (socketId !== socket.id) {
            socket.emit("request-offer", { to: socketId })
          }
        } else {
          // if there is no presenter, request a lobby offer
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

  const presenter = () => {
    return presenterId ? presenterId : "Nobody"
  }

  const setLocalVideo = (element, callback) => {
    navigator.getUserMedia(
      { video: true, audio: true },
      stream => {
        if (element) {
          element.srcObject = stream
          callback()
        }
      },
      (error) => { console.log(error) }
    )
  }

  const join = async isPresenter => {
    if (isPresenter)
      setLocalVideo(localVideo.current, () => { socket.emit("join", isPresenter) })
    else
      setLocalVideo(localVideo.current, () => { socket.emit("join", isPresenter) })
  }

  const leave = () => {
    socket.emit("leave")
  }

  const joinAsPresenterButton = () => {
    return presenterId ? "" : (<button onClick={() => { join(true) }}>join as presenter</button>)
  }

  const participantsList = () => {
    return Object.entries(participants).map(([key, value]) => {
      return (<li key={key}>
        {value.name}{key === presenterId ? " (Presenter)" : ""}
      </li>)
    })
  }

  const joinLeaveButtons = () => {
    return socket && participants[socket.id]
      ? (<button onClick={leave}>leave</button>)
      : (<div><button onClick={() => { join(false) }}>join</button>{joinAsPresenterButton()}</div>)
  }

  const lobbyVideos = () => {
    return Object.keys(participants).filter(socketId => socketId !== socket.id).map(socketId => {
      return (<video key={socketId} id={`lobby-${socketId}`} autoPlay style={{ border: "3px solid red", width: "8em", height: "4.5em" }} />)
    })
  }

  return (
    <div>
      <h1>Video broadcast</h1>
      <p>{presenter()} is presenting</p>
      {joinLeaveButtons()}
      <h2>Participants</h2>
      <ul>
        {participantsList()}
      </ul>
      <div style={{ display: "flex", flexDirection: "row" }}>
        <div>
          <h2>Local</h2>
          <video ref={localVideo} autoPlay muted style={{ border: "3px solid green", width: "16em", height: "9em" }} />
        </div>
        <div>
          <h2>Remote</h2>
          <video ref={remoteVideo} autoPlay muted style={{ border: "3px solid red", width: "16em", height: "9em" }} />
        </div>
      </div>
      <div ref={remoteLobbyVideos}>
        <video ref={localLobbyVideo} autoPlay muted style={{ border: "3px solid green", width: "8em", height: "4.5em" }} />
        {lobbyVideos()}
      </div>
    </div>
  )
}

export default App