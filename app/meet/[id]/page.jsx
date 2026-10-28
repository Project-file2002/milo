'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { io } from 'socket.io-client';
import VideoGrid from '@/components/VideoGrid';
import ControlBar from '@/components/ControlBar';
import SidePanel from '@/components/SidePanel';
import Whiteboard from '@/components/Whiteboard';
import LiveCaptions from '@/components/LiveCaptions';
import LobbyModal from '@/components/LobbyModal';
import AISummaryModal from '@/components/AISummaryModal';
import { WebRTCManager, createAudioSpeakerDetector } from '@/lib/webrtc';
import confetti from 'canvas-confetti';

export default function MeetingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const roomId = params?.id || 'milo-room';
  const isHostIntent = searchParams?.get('host') === 'true';

  // UI Flow State
  const [inMeeting, setInMeeting] = useState(false);
  const [isWaitingForHost, setIsWaitingForHost] = useState(false);
  const [isDenied, setIsDenied] = useState(false);
  const [userName, setUserName] = useState('Abhishek');
  const [isHost, setIsHost] = useState(isHostIntent);

  // Media States
  const [localStream, setLocalStream] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [screenStream, setScreenStream] = useState(null);
  const [screenPresenterName, setScreenPresenterName] = useState('');
  const [isLowDataMode, setIsLowDataMode] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [pinnedPeerId, setPinnedPeerId] = useState(null);
  const [activeSpeakerId, setActiveSpeakerId] = useState(null);

  // In-Call Data States
  const [participants, setParticipants] = useState([]); // [{ id, userName, audio, video, handRaised, isHost }]
  const [remoteStreams, setRemoteStreams] = useState({}); // { [peerId]: MediaStream }
  const [waitingList, setWaitingList] = useState([]); // [{ peerId, userName }]
  const [chatMessages, setChatMessages] = useState([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [breakoutRooms, setBreakoutRooms] = useState([]);
  const [captionsLog, setCaptionsLog] = useState([]);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [activePanel, setActivePanel] = useState(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState('');

  // Refs for instances
  const socketRef = useRef(null);
  const rtcManagerRef = useRef(null);
  const speakerDetectorRef = useRef(null);

  // Initialize Local Media on mount for pre-meeting lobby
  useEffect(() => {
    let mounted = true;

    async function initMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
        if (mounted) {
          setLocalStream(stream);
        }
      } catch (err) {
        console.warn('getUserMedia failed, trying audio only or dummy stream:', err);
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (mounted) setLocalStream(audioStream);
        } catch (e) {
          console.warn('Camera/Mic permission denied or not found.');
        }
      }
    }

    initMedia();

    return () => {
      mounted = false;
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Set up local speaker detection
  useEffect(() => {
    if (!localStream || !inMeeting) return;

    speakerDetectorRef.current = createAudioSpeakerDetector(localStream, (speaking) => {
      if (speaking && audioEnabled) {
        setActiveSpeakerId('local');
      } else if (!speaking && activeSpeakerId === 'local') {
        setActiveSpeakerId(null);
      }
    });

    return () => {
      if (speakerDetectorRef.current) {
        speakerDetectorRef.current.destroy();
      }
    };
  }, [localStream, inMeeting, audioEnabled, activeSpeakerId]);

  // Connect Socket & WebRTC when user clicks "Join now"
  const handleJoinMeeting = useCallback(() => {
    if (socketRef.current) return;

    const socket = io(typeof window !== 'undefined' ? window.location.origin : '', {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    // Initialize WebRTC Manager
    const rtc = new WebRTCManager({
      localStream,
      onRemoteStream: (peerId, stream) => {
        setRemoteStreams((prev) => ({ ...prev, [peerId]: stream }));
      },
      onPeerDisconnected: (peerId) => {
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[peerId];
          return next;
        });
      },
      sendSignal: ({ to, signal, meta }) => {
        socket.emit('signal', { to, signal, meta });
      },
    });
    rtcManagerRef.current = rtc;

    // Socket Event Handlers
    socket.on('connect', () => {
      socket.emit('join-room', {
        roomId,
        userName: userName.trim() || 'Participant',
        isHostIntent,
      });
    });

    socket.on('waiting-for-host', () => {
      setIsWaitingForHost(true);
    });

    socket.on('lobby-denied', () => {
      setIsWaitingForHost(false);
      setIsDenied(true);
    });

    socket.on('room-joined', ({ roomId, peerId, isHost: assignedHost, participants: existingPeers, chatHistory, breakoutRooms: existingBreakouts }) => {
      setIsWaitingForHost(false);
      setInMeeting(true);
      setIsHost(assignedHost);
      setParticipants(existingPeers);
      if (chatHistory) setChatMessages(chatHistory);
      if (existingBreakouts) setBreakoutRooms(existingBreakouts);

      // Initiate WebRTC mesh peer connection with each existing member
      existingPeers.forEach((peer) => {
        rtc.initiateOffer(peer.id);
      });
    });

    socket.on('user-connected', (newUser) => {
      setParticipants((prev) => {
        if (prev.some((p) => p.id === newUser.id)) return prev;
        return [...prev, newUser];
      });
      // New user will initiate offer, rtcManager will receive it
    });

    socket.on('signal', ({ from, signal }) => {
      rtc.handleSignal(from, signal);
    });

    socket.on('participant-media-changed', ({ peerId, type, enabled }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.id === peerId ? { ...p, [type]: enabled } : p))
      );
    });

    socket.on('new-message', (message) => {
      setChatMessages((prev) => [...prev, message]);
      if (activePanel !== 'chat') {
        setUnreadChatCount((prev) => prev + 1);
      }
    });

    socket.on('user-reaction', ({ senderName, emoji }) => {
      // Trigger floating reaction animation
      const id = Date.now() + Math.random();
      const leftPos = Math.floor(Math.random() * 60) + 20; // 20% to 80% screen width
      setFloatingReactions((prev) => [...prev, { id, emoji, left: `${leftPos}%` }]);
      setTimeout(() => {
        setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
      }, 3000);

      if (emoji === '🎉') {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
      }
    });

    socket.on('user-hand-toggled', ({ peerId, raised }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.id === peerId ? { ...p, handRaised: raised } : p))
      );
    });

    socket.on('waiting-room-request', (guest) => {
      setWaitingList((prev) => [...prev, guest]);
    });

    socket.on('waiting-room-left', ({ peerId }) => {
      setWaitingList((prev) => prev.filter((g) => g.peerId !== peerId));
    });

    socket.on('user-disconnected', ({ peerId }) => {
      setParticipants((prev) => prev.filter((p) => p.id !== peerId));
      rtc.closePeer(peerId);
    });

    socket.on('host-changed', ({ newHostId }) => {
      if (socket.id === newHostId) {
        setIsHost(true);
      }
      setParticipants((prev) =>
        prev.map((p) => ({ ...p, isHost: p.id === newHostId }))
      );
    });

    socket.on('breakout-rooms-updated', (rooms) => {
      setBreakoutRooms(rooms);
    });

    socket.on('breakout-rooms-closed', () => {
      setBreakoutRooms([]);
    });
  }, [roomId, userName, isHostIntent, localStream, activePanel]);

  // Toggle Audio
  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
        if (socketRef.current) {
          socketRef.current.emit('toggle-media', {
            roomId,
            type: 'audio',
            enabled: audioTrack.enabled,
          });
        }
      }
    }
  };

  // Toggle Video
  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
        if (socketRef.current) {
          socketRef.current.emit('toggle-media', {
            roomId,
            type: 'video',
            enabled: videoTrack.enabled,
          });
        }
      }
    }
  };

  // Toggle Screen Sharing
  const toggleScreenShare = async () => {
    if (screenStream) {
      // Stop screen sharing
      screenStream.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
      setScreenPresenterName('');
      if (localStream && rtcManagerRef.current) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          rtcManagerRef.current.replaceVideoTrack(videoTrack);
        }
      }
    } else {
      // Start screen sharing
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: true,
        });
        const screenTrack = displayStream.getVideoTracks()[0];
        setScreenStream(displayStream);
        setScreenPresenterName(userName);

        if (rtcManagerRef.current) {
          rtcManagerRef.current.replaceVideoTrack(screenTrack);
        }

        screenTrack.onended = () => {
          setScreenStream(null);
          setScreenPresenterName('');
          if (localStream && rtcManagerRef.current) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
              rtcManagerRef.current.replaceVideoTrack(videoTrack);
            }
          }
        };
      } catch (err) {
        console.warn('Screen share cancelled or failed:', err);
      }
    }
  };

  // Toggle Low Data Mode (Bandwidth Saver)
  const toggleLowDataMode = () => {
    const nextVal = !isLowDataMode;
    setIsLowDataMode(nextVal);
    if (rtcManagerRef.current) {
      rtcManagerRef.current.setLowDataMode(nextVal);
    }
  };

  // Raise / Lower Hand
  const toggleHand = () => {
    const next = !handRaised;
    setHandRaised(next);
    if (socketRef.current) {
      socketRef.current.emit('toggle-hand', {
        roomId,
        raised: next,
        senderName: userName,
      });
    }
  };

  // Send In-Meeting Chat Message
  const handleSendMessage = (text) => {
    if (socketRef.current) {
      socketRef.current.emit('send-message', {
        roomId,
        text,
        senderName: userName,
      });
    }
  };

  // Send Floating Reaction
  const handleSendReaction = (emoji) => {
    if (socketRef.current) {
      socketRef.current.emit('send-reaction', {
        roomId,
        emoji,
        senderName: userName,
      });
    }
  };

  // Host Lobby Decision (Admit or Deny Guest)
  const handleHostLobbyDecision = (targetPeerId, approved) => {
    if (socketRef.current && isHost) {
      socketRef.current.emit('host-lobby-decision', {
        roomId,
        targetPeerId,
        approved,
      });
      setWaitingList((prev) => prev.filter((g) => g.peerId !== targetPeerId));
    }
  };

  // Breakout Rooms Controls
  const handleCreateBreakout = (count) => {
    if (socketRef.current && isHost) {
      socketRef.current.emit('create-breakout-rooms', { roomId, count });
    }
  };

  const handleCloseBreakout = () => {
    if (socketRef.current && isHost) {
      socketRef.current.emit('close-breakout-rooms', { roomId });
    }
  };

  // Leave Meeting & Trigger Post-Call AI Summary
  const handleLeaveMeeting = async () => {
    // Generate AI Summary before routing home
    try {
      const res = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingTitle: `Milo Conference (${roomId})`,
          captionsLog,
          chatMessages,
          participants: [{ userName, isHost }, ...participants],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedSummary(data.summary);
        setShowSummaryModal(true);
      } else {
        router.push('/');
      }
    } catch (e) {
      router.push('/');
    }
  };

  // Pre-meeting Lobby Screen
  if (!inMeeting) {
    return (
      <LobbyModal
        roomId={roomId}
        userName={userName}
        setUserName={setUserName}
        localStream={localStream}
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        isLowDataMode={isLowDataMode}
        isWaitingForHost={isWaitingForHost}
        isDenied={isDenied}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleLowData={toggleLowDataMode}
        onJoin={handleJoinMeeting}
        onBackToHome={() => router.push('/')}
      />
    );
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#202124',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Floating Emojis Overlay */}
      {floatingReactions.map((r) => (
        <div key={r.id} className="floating-reaction" style={{ left: r.left, bottom: '100px' }}>
          {r.emoji}
        </div>
      ))}

      {/* Main Video Viewport & Side Panel Container */}
      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        {/* Left/Center: Video Grid & Canvas */}
        <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
          <VideoGrid
            localStream={localStream}
            localUser={{ userName, isHost, audio: audioEnabled, video: videoEnabled, handRaised }}
            remoteStreams={remoteStreams}
            participants={participants}
            screenStream={screenStream}
            screenPresenterName={screenPresenterName}
            pinnedPeerId={pinnedPeerId}
            onTogglePin={(id) => setPinnedPeerId(pinnedPeerId === id ? null : id)}
            isLowDataMode={isLowDataMode}
            activeSpeakerId={activeSpeakerId}
          />

          {/* Collaborative Milo Board Overlay */}
          {isWhiteboardOpen && (
            <Whiteboard
              roomId={roomId}
              socket={socketRef.current}
              onClose={() => setIsWhiteboardOpen(false)}
            />
          )}

          {/* Live Indian Language Captions Overlay */}
          <LiveCaptions
            roomId={roomId}
            socket={socketRef.current}
            localUserName={userName}
            enabled={captionsEnabled}
            onCaptionLogged={(caption) => setCaptionsLog((prev) => [...prev, caption])}
          />
        </div>

        {/* Right Slide-over Side Panel */}
        <SidePanel
          activePanel={activePanel}
          roomId={roomId}
          isHost={isHost}
          localUser={{ id: socketRef.current?.id || 'local', userName, isHost }}
          participants={participants}
          waitingList={waitingList}
          chatMessages={chatMessages}
          breakoutRooms={breakoutRooms}
          captionsLog={captionsLog}
          onClose={() => setActivePanel(null)}
          onSendMessage={handleSendMessage}
          onHostLobbyDecision={handleHostLobbyDecision}
          onCreateBreakout={handleCreateBreakout}
          onCloseBreakout={handleCloseBreakout}
        />
      </div>

      {/* Bottom Floating Google Meet Control Bar */}
      <ControlBar
        roomId={roomId}
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        captionsEnabled={captionsEnabled}
        handRaised={handRaised}
        isScreenSharing={!!screenStream}
        isWhiteboardOpen={isWhiteboardOpen}
        isLowDataMode={isLowDataMode}
        isHost={isHost}
        activePanel={activePanel}
        participantCount={1 + participants.length}
        unreadCount={unreadChatCount}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleCaptions={() => setCaptionsEnabled(!captionsEnabled)}
        onToggleHand={toggleHand}
        onToggleScreenShare={toggleScreenShare}
        onToggleWhiteboard={() => setIsWhiteboardOpen(!isWhiteboardOpen)}
        onToggleLowData={toggleLowDataMode}
        onTogglePanel={(panel) => {
          setActivePanel(panel);
          if (panel === 'chat') setUnreadChatCount(0);
        }}
        onSendReaction={handleSendReaction}
        onLeaveMeeting={handleLeaveMeeting}
      />

      {/* Post-Meeting AI Summary Modal */}
      {showSummaryModal && (
        <AISummaryModal
          summary={generatedSummary}
          roomId={roomId}
          onClose={() => setShowSummaryModal(false)}
          onBackHome={() => router.push('/')}
        />
      )}
    </div>
  );
}
