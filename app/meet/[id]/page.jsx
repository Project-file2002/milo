'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createSignaling } from '@/lib/signaling';
import VideoGrid from '@/components/VideoGrid';
import ControlBar from '@/components/ControlBar';
import SidePanel from '@/components/SidePanel';
import Whiteboard from '@/components/Whiteboard';
import LiveCaptions from '@/components/LiveCaptions';
import LobbyModal from '@/components/LobbyModal';
import AISummaryModal from '@/components/AISummaryModal';
import { WebRTCManager, createAudioSpeakerDetector } from '@/lib/webrtc';
import { loadSettings } from '@/lib/settings';
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
  const [captionLanguage, setCaptionLanguage] = useState('hi-IN');
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
  const [whiteboardStrokes, setWhiteboardStrokes] = useState([]);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [activePanel, setActivePanel] = useState(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState('');

  // Refs for instances
  const socketRef = useRef(null);
  const rtcManagerRef = useRef(null);
  const speakerDetectorRef = useRef(null);

  // Apply saved preferences (name, low-data default, caption language) before joining
  useEffect(() => {
    const saved = loadSettings();
    if (saved.displayName) setUserName(saved.displayName);
    if (saved.lowDataDefault) setIsLowDataMode(true);
    if (saved.captionLanguage) setCaptionLanguage(saved.captionLanguage);
  }, []);

  // Initialize Local Media on mount for pre-meeting lobby
  useEffect(() => {
    let mounted = true;
    const stopIfUnmounted = (stream) => {
      if (!mounted) {
        stream.getTracks().forEach((t) => t.stop());
        return false;
      }
      return true;
    };

    async function initMedia() {
      const saved = loadSettings();
      const baseVideo = { width: { ideal: 1280 }, height: { ideal: 720 } };
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: saved.cameraId ? { ...baseVideo, deviceId: { exact: saved.cameraId } } : baseVideo,
          audio: saved.microphoneId ? { deviceId: { exact: saved.microphoneId } } : true,
        });
        if (stopIfUnmounted(stream)) setLocalStream(stream);
      } catch (err) {
        console.warn('getUserMedia failed with saved devices, falling back:', err);
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: baseVideo, audio: true });
          if (stopIfUnmounted(stream)) setLocalStream(stream);
        } catch (e) {
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (stopIfUnmounted(audioStream)) setLocalStream(audioStream);
          } catch (err2) {
            console.warn('Camera/Mic permission denied or not found.');
          }
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

    // Supabase Realtime on serverless hosting (Vercel); Socket.io otherwise.
    const socket = createSignaling({
      roomId,
      userName: userName.trim() || 'Participant',
      isHostIntent,
    });
    socketRef.current = socket;
    if (typeof window !== 'undefined') {
      window.__MILO_SIGNALING__ = socket.transportName || 'socketio';
    }

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
    if (typeof window !== 'undefined') window.__MILO_RTC__ = rtc;
    if (isLowDataMode) rtc.setLowDataMode(true);

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

    socket.on('room-joined', ({ roomId, peerId, isHost: assignedHost, participants: existingPeers, chatHistory, whiteboardStrokes: syncedStrokes, breakoutRooms: existingBreakouts }) => {
      setIsWaitingForHost(false);
      setInMeeting(true);
      setIsHost(assignedHost);
      setParticipants(existingPeers);
      if (chatHistory) setChatMessages(chatHistory);
      if (syncedStrokes) setWhiteboardStrokes(syncedStrokes);
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

    // Keep an in-page stroke log so the Milo Board can be re-opened with full history
    socket.on('whiteboard-draw', (stroke) => {
      setWhiteboardStrokes((prev) => [...prev, stroke]);
    });

    socket.on('whiteboard-clear', () => {
      setWhiteboardStrokes([]);
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
  }, [roomId, userName, isHostIntent, localStream, activePanel, isLowDataMode]);

  // Full teardown when the meeting page unmounts (leaving via router or tab close)
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (rtcManagerRef.current) {
        rtcManagerRef.current.closeAll();
        rtcManagerRef.current = null;
      }
    };
  }, []);

  // Keep the RTC manager's outbound tracks in sync with the media stream (which may arrive after join)
  useEffect(() => {
    if (rtcManagerRef.current && localStream) {
      rtcManagerRef.current.setLocalStream(localStream);
    }
  }, [localStream, inMeeting]);

  // Switch to a different microphone or camera picked from DeviceMenu
  const switchDevice = useCallback(
    async (kind, deviceId) => {
      if (!deviceId) return;
      try {
        const constraints =
          kind === 'audio'
            ? { audio: { deviceId: { exact: deviceId } } }
            : { video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } };
        const incoming = await navigator.mediaDevices.getUserMedia(constraints);
        const newTrack = (kind === 'audio' ? incoming.getAudioTracks() : incoming.getVideoTracks())[0];
        if (!newTrack) return;

        const next = new MediaStream();
        (localStream ? localStream.getTracks() : []).forEach((t) => {
          if (t.kind === kind) t.stop();
          else next.addTrack(t);
        });
        next.addTrack(newTrack);

        setLocalStream(next);
        if (kind === 'audio') setAudioEnabled(newTrack.enabled);
        else setVideoEnabled(newTrack.enabled);

        if (rtcManagerRef.current) rtcManagerRef.current.replaceTrack(kind, newTrack);
      } catch (err) {
        console.warn(`Could not switch ${kind} device:`, err);
      }
    },
    [localStream]
  );

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
        onSwitchDevice={switchDevice}
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
              initialStrokes={whiteboardStrokes}
              onClose={() => setIsWhiteboardOpen(false)}
            />
          )}

          {/* Live Indian Language Captions Overlay */}
          <LiveCaptions
            roomId={roomId}
            socket={socketRef.current}
            localUserName={userName}
            enabled={captionsEnabled}
            defaultLanguage={captionLanguage}
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
        localStream={localStream}
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
        onSwitchDevice={switchDevice}
      />

      {/* Post-Meeting AI Summary Modal */}
      {showSummaryModal && (
        <AISummaryModal
          summary={generatedSummary}
          roomId={roomId}
          onClose={() => {
            setShowSummaryModal(false);
            router.push('/');
          }}
          onBackHome={() => router.push('/')}
        />
      )}
    </div>
  );
}
