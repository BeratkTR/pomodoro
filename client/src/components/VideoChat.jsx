import React, { useState, useEffect, useRef } from 'react'
import './VideoChat.css'
import socketService from '../services/socketService'

const VideoChat = ({ currentRoom, currentUser, roomUsers }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isCallActive, setIsCallActive] = useState(false)
  const [incomingCall, setIncomingCall] = useState(false)
  const [callRejected, setCallRejected] = useState(false)
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const peerConnectionRef = useRef(null)
  const pendingIceCandidates = useRef([])

  // WebRTC configuration
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  }

  // Get partner user
  const partner = roomUsers?.find(user => user.id !== currentUser.id)

  // Initialize socket listeners
  useEffect(() => {
    const handleVideoCallRequest = (data) => {
      console.log('📞 Received video call request from:', data.fromUserId)
      setIncomingCall(true)
      setCallRejected(false)
    }

    const handleVideoCallAccepted = async (data) => {
      console.log('✅ Video call accepted by partner')
      setIncomingCall(false)
      await startCall(true) // Caller initiates the connection
    }

    const handleVideoCallRejected = (data) => {
      console.log('❌ Video call rejected by partner')
      setCallRejected(true)
      setIncomingCall(false)
      setTimeout(() => setCallRejected(false), 3000)
      cleanup()
    }

    const handleVideoOffer = async (data) => {
      console.log('📨 Received video offer')
      try {
        if (!peerConnectionRef.current) {
          await createPeerConnection()
        }
        
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.offer))
        
        // Process pending ICE candidates
        if (pendingIceCandidates.current.length > 0) {
          console.log(`Processing ${pendingIceCandidates.current.length} pending ICE candidates`)
          for (const candidate of pendingIceCandidates.current) {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate))
          }
          pendingIceCandidates.current = []
        }
        
        const answer = await peerConnectionRef.current.createAnswer()
        await peerConnectionRef.current.setLocalDescription(answer)
        
        socketService.sendVideoAnswer(answer, data.fromUserId)
        
        setIsCallActive(true)
      } catch (error) {
        console.error('Error handling video offer:', error)
      }
    }

    const handleVideoAnswer = async (data) => {
      console.log('📨 Received video answer')
      try {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer))
        
        // Process pending ICE candidates
        if (pendingIceCandidates.current.length > 0) {
          console.log(`Processing ${pendingIceCandidates.current.length} pending ICE candidates`)
          for (const candidate of pendingIceCandidates.current) {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate))
          }
          pendingIceCandidates.current = []
        }
        
        setIsCallActive(true)
      } catch (error) {
        console.error('Error handling video answer:', error)
      }
    }

    const handleIceCandidate = async (data) => {
      console.log('❄️ Received ICE candidate')
      try {
        if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate))
        } else {
          console.log('Storing ICE candidate for later')
          pendingIceCandidates.current.push(data.candidate)
        }
      } catch (error) {
        console.error('Error adding ICE candidate:', error)
      }
    }

    const handleVideoCallEnded = () => {
      console.log('📴 Video call ended by partner')
      cleanup()
      setIsCallActive(false)
      setIncomingCall(false)
    }

    socketService.on('video_call_request', handleVideoCallRequest)
    socketService.on('video_call_accepted', handleVideoCallAccepted)
    socketService.on('video_call_rejected', handleVideoCallRejected)
    socketService.on('video_offer', handleVideoOffer)
    socketService.on('video_answer', handleVideoAnswer)
    socketService.on('ice_candidate', handleIceCandidate)
    socketService.on('video_call_ended', handleVideoCallEnded)

    return () => {
      socketService.off('video_call_request', handleVideoCallRequest)
      socketService.off('video_call_accepted', handleVideoCallAccepted)
      socketService.off('video_call_rejected', handleVideoCallRejected)
      socketService.off('video_offer', handleVideoOffer)
      socketService.off('video_answer', handleVideoAnswer)
      socketService.off('ice_candidate', handleIceCandidate)
      socketService.off('video_call_ended', handleVideoCallEnded)
    }
  }, [])

  // Create peer connection
  const createPeerConnection = async () => {
    try {
      const peerConnection = new RTCPeerConnection(configuration)
      
      // Add local stream tracks
      if (localStream) {
        localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStream)
        })
      }

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && partner) {
          console.log('❄️ Sending ICE candidate')
          socketService.sendIceCandidate(event.candidate, partner.id)
        }
      }

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        console.log('🎥 Received remote stream')
        setRemoteStream(event.streams[0])
      }

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.connectionState)
        if (peerConnection.connectionState === 'disconnected' || 
            peerConnection.connectionState === 'failed' ||
            peerConnection.connectionState === 'closed') {
          cleanup()
        }
      }

      peerConnectionRef.current = peerConnection
      return peerConnection
    } catch (error) {
      console.error('Error creating peer connection:', error)
      throw error
    }
  }

  // Start call (caller)
  const startCall = async (isInitiator) => {
    try {
      console.log('🎥 Starting video call, isInitiator:', isInitiator)
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      })
      
      setLocalStream(stream)
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      // Create peer connection
      await createPeerConnection()

      // If initiator, create and send offer
      if (isInitiator) {
        const offer = await peerConnectionRef.current.createOffer()
        await peerConnectionRef.current.setLocalDescription(offer)
        
        socketService.sendVideoOffer(offer, partner.id)
      }

      setIsOpen(true)
    } catch (error) {
      console.error('Error starting call:', error)
      alert('Could not access camera/microphone. Please check permissions.')
      cleanup()
    }
  }

  // Handle video call request
  const handleRequestCall = () => {
    if (!partner) {
      alert('No partner available for video call')
      return
    }

    console.log('📞 Requesting video call to:', partner.id)
    socketService.sendVideoCallRequest(partner.id)
  }

  // Handle accept call
  const handleAcceptCall = async () => {
    console.log('✅ Accepting video call')
    socketService.acceptVideoCall(partner.id)
    setIncomingCall(false)
    await startCall(false) // Receiver waits for offer
  }

  // Handle reject call
  const handleRejectCall = () => {
    console.log('❌ Rejecting video call')
    socketService.rejectVideoCall(partner.id)
    setIncomingCall(false)
  }

  // End call
  const handleEndCall = () => {
    console.log('📴 Ending video call')
    if (partner) {
      socketService.endVideoCall(partner.id)
    }
    cleanup()
  }

  // Cleanup
  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop())
      setLocalStream(null)
    }
    
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop())
      setRemoteStream(null)
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    
    pendingIceCandidates.current = []
    setIsCallActive(false)
    setIsOpen(false)
  }

  // Update video refs when streams change
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [])

  // Don't show if no room
  if (!currentRoom) {
    return null
  }

  return (
    <>
      {/* Video Call Toggle Button */}
      <div className="video-widget-container">
        <button 
          className="video-toggle-btn" 
          onClick={handleRequestCall}
          disabled={!partner || isCallActive}
          aria-label="Start video call"
          title={!partner ? 'Waiting for partner' : 'Start video call'}
        >
          <span className="video-icon">📹</span>
        </button>

        {/* Incoming Call Notification */}
        {incomingCall && (
          <div className="incoming-call-notification">
            <div className="incoming-call-content">
              <h4>📞 Incoming Video Call</h4>
              <p>{partner?.name} wants to video chat</p>
              <div className="incoming-call-buttons">
                <button className="accept-btn" onClick={handleAcceptCall}>
                  Accept
                </button>
                <button className="reject-btn" onClick={handleRejectCall}>
                  Reject
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Call Rejected Notification */}
        {callRejected && (
          <div className="call-status-notification rejected">
            <p>❌ Call was rejected</p>
          </div>
        )}

        {/* Video Interface */}
        {isOpen && isCallActive && (
          <div className="video-interface">
            <div className="video-header">
              <h3>Video Call with {partner?.name}</h3>
              <button 
                className="video-close-btn" 
                onClick={handleEndCall}
                aria-label="End call"
              >
                ✕
              </button>
            </div>

            <div className="video-container">
              {/* Remote Video (Partner) */}
              <div className="video-box remote-video">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                />
                {!remoteStream && (
                  <div className="video-placeholder">
                    <p>Waiting for {partner?.name}...</p>
                  </div>
                )}
                <span className="video-label">{partner?.name}</span>
              </div>

              {/* Local Video (You) */}
              <div className="video-box local-video">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                />
                <span className="video-label">You</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default VideoChat

