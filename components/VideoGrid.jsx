'use strict';
import React, { useRef, useEffect } from 'react';
import { Mic, MicOff, Video, VideoOff, Pin, PinOff, Monitor, WifiOff } from 'lucide-react';

export default function VideoGrid({
  localStream,
  localUser,
  remoteStreams = {},
  participants = [],
  screenStream = null,
  screenPresenterName = '',
  pinnedPeerId = null,
  onTogglePin = () => {},
  isLowDataMode = false,
  activeSpeakerId = null,
}) {
  // Combine all participant tiles
  const totalTiles = 1 + Object.keys(remoteStreams).length + (screenStream ? 1 : 0);

  // Dynamic grid class calculation
  const getGridClass = () => {
    if (pinnedPeerId || screenStream) return 'grid-spotlight';
    if (totalTiles <= 1) return 'grid-1';
    if (totalTiles === 2) return 'grid-2';
    if (totalTiles <= 4) return 'grid-4';
    if (totalTiles <= 6) return 'grid-6';
    return 'grid-many';
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', padding: '12px' }}>
      {screenStream ? (
        // Spotlight Screen Share View
        <div style={{ display: 'flex', width: '100%', height: '100%', gap: '12px' }}>
          <div style={{ flex: '1 1 78%', height: '100%', position: 'relative', borderRadius: '16px', overflow: 'hidden', background: '#000' }}>
            <ScreenShareTile stream={screenStream} presenterName={screenPresenterName} />
          </div>
          <div style={{ flex: '0 0 280px', height: '100%', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
            {/* Local participant thumbnail */}
            <div style={{ height: '160px', position: 'relative', borderRadius: '12px', overflow: 'hidden' }}>
              <ParticipantTile
                isLocal
                stream={localStream}
                user={localUser}
                isLowDataMode={isLowDataMode}
                isSpeaking={activeSpeakerId === 'local'}
              />
            </div>
            {/* Remote participant thumbnails */}
            {participants.map((p) => (
              <div key={p.id} style={{ height: '160px', position: 'relative', borderRadius: '12px', overflow: 'hidden' }}>
                <ParticipantTile
                  stream={remoteStreams[p.id]}
                  user={p}
                  isSpeaking={activeSpeakerId === p.id}
                  isPinned={pinnedPeerId === p.id}
                  onTogglePin={() => onTogglePin(p.id)}
                />
              </div>
            ))}
          </div>
        </div>
      ) : pinnedPeerId ? (
        // Spotlight Pinned View
        <div style={{ display: 'flex', width: '100%', height: '100%', gap: '12px' }}>
          <div style={{ flex: '1 1 78%', height: '100%', position: 'relative', borderRadius: '16px', overflow: 'hidden' }}>
            {pinnedPeerId === 'local' ? (
              <ParticipantTile
                isLocal
                stream={localStream}
                user={localUser}
                isLowDataMode={isLowDataMode}
                isSpeaking={activeSpeakerId === 'local'}
                isPinned
                onTogglePin={() => onTogglePin('local')}
              />
            ) : (
              <ParticipantTile
                stream={remoteStreams[pinnedPeerId]}
                user={participants.find((p) => p.id === pinnedPeerId) || { userName: 'Participant' }}
                isSpeaking={activeSpeakerId === pinnedPeerId}
                isPinned
                onTogglePin={() => onTogglePin(pinnedPeerId)}
              />
            )}
          </div>
          <div style={{ flex: '0 0 280px', height: '100%', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
            {pinnedPeerId !== 'local' && (
              <div style={{ height: '160px', position: 'relative', borderRadius: '12px', overflow: 'hidden' }}>
                <ParticipantTile
                  isLocal
                  stream={localStream}
                  user={localUser}
                  isLowDataMode={isLowDataMode}
                  isSpeaking={activeSpeakerId === 'local'}
                  onTogglePin={() => onTogglePin('local')}
                />
              </div>
            )}
            {participants
              .filter((p) => p.id !== pinnedPeerId)
              .map((p) => (
                <div key={p.id} style={{ height: '160px', position: 'relative', borderRadius: '12px', overflow: 'hidden' }}>
                  <ParticipantTile
                    stream={remoteStreams[p.id]}
                    user={p}
                    isSpeaking={activeSpeakerId === p.id}
                    onTogglePin={() => onTogglePin(p.id)}
                  />
                </div>
              ))}
          </div>
        </div>
      ) : (
        // Standard Adaptive Grid
        <div className={getGridClass()} style={{ height: '100%', width: '100%' }}>
          <ParticipantTile
            isLocal
            stream={localStream}
            user={localUser}
            isLowDataMode={isLowDataMode}
            isSpeaking={activeSpeakerId === 'local'}
            onTogglePin={() => onTogglePin('local')}
          />
          {participants.map((p) => (
            <ParticipantTile
              key={p.id}
              stream={remoteStreams[p.id]}
              user={p}
              isSpeaking={activeSpeakerId === p.id}
              isPinned={pinnedPeerId === p.id}
              onTogglePin={() => onTogglePin(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Individual Participant Tile
function ParticipantTile({
  stream,
  user,
  isLocal = false,
  isLowDataMode = false,
  isSpeaking = false,
  isPinned = false,
  onTogglePin,
}) {
  const videoRef = useRef(null);
  const hasVideo = stream && stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled && !isLowDataMode;

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      // Autoplay can be deferred while the tile is hidden (avatar fallback);
      // an explicit play() resumes it as soon as a track arrives.
      videoRef.current.play?.().catch(() => {});
    }
  }, [stream]);

  // Generate color palette based on username
  const getAvatarBg = (name = '') => {
    const colors = ['#1a73e8', '#ea4335', '#fbbc04', '#34a853', '#9c27b0', '#0097a7', '#e91e63'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
    return colors[Math.abs(hash) % colors.length];
  };

  const initial = (user?.userName || 'User').charAt(0).toUpperCase();

  return (
    <div
      data-participant-tile={isLocal ? 'local' : user?.id}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#303134',
        borderRadius: '16px',
        overflow: 'hidden',
        border: isSpeaking ? '2.5px solid #8ab4f8' : '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: isSpeaking ? '0 0 16px rgba(138, 180, 248, 0.45)' : 'none',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: isLocal ? 'scaleX(-1)' : 'none',
          display: hasVideo ? 'block' : 'none',
        }}
      />

      {/* Avatar Fallback if camera off or low data mode */}
      {!hasVideo && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '84px',
              height: '84px',
              borderRadius: '50%',
              backgroundColor: getAvatarBg(user?.userName),
              color: '#fff',
              fontSize: '36px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
              position: 'relative',
            }}
          >
            {initial}
            {isSpeaking && (
              <div
                style={{
                  position: 'absolute',
                  inset: '-6px',
                  borderRadius: '50%',
                  border: '2px solid #8ab4f8',
                  animation: 'pulseSpeaking 1.5s infinite',
                }}
              />
            )}
          </div>
          {isLowDataMode && isLocal && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                padding: '4px 8px',
                borderRadius: '12px',
                backgroundColor: 'rgba(52, 168, 83, 0.2)',
                color: '#81c995',
                border: '1px solid rgba(52, 168, 83, 0.4)',
              }}
            >
              <WifiOff size={12} /> Low Data Mode Active
            </div>
          )}
        </div>
      )}

      {/* Hand Raised Badge */}
      {user?.handRaised && (
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            backgroundColor: '#fbbc04',
            color: '#202124',
            padding: '4px 8px',
            borderRadius: '16px',
            fontSize: '12px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            zIndex: 10,
          }}
        >
          ✋ Hand Raised
        </div>
      )}

      {/* Top Right Pin Button */}
      {onTogglePin && (
        <button
          onClick={onTogglePin}
          title={isPinned ? 'Unpin' : 'Pin to screen'}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: isPinned ? '#8ab4f8' : 'rgba(0,0,0,0.5)',
            color: isPinned ? '#202124' : '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isPinned ? 1 : 0.8,
            transition: 'all 0.2s',
            zIndex: 10,
          }}
        >
          {isPinned ? <PinOff size={16} /> : <Pin size={16} />}
        </button>
      )}

      {/* Bottom Name & Audio Indicator Bar */}
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          left: '12px',
          right: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            padding: '4px 10px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '500',
            color: '#e8eaed',
          }}
        >
          <span>{user?.userName || 'User'} {isLocal ? '(You)' : ''}</span>
          {user?.isHost && (
            <span
              style={{
                fontSize: '10px',
                backgroundColor: '#1a73e8',
                color: '#fff',
                padding: '1px 5px',
                borderRadius: '4px',
                fontWeight: '600',
              }}
            >
              HOST
            </span>
          )}
        </div>

        {/* Mic Status Icon */}
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: user?.audio === false ? '#ea4335' : 'rgba(0, 0, 0, 0.65)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {user?.audio === false ? <MicOff size={14} /> : <Mic size={14} />}
        </div>
      </div>
    </div>
  );
}

// Screen Share Spotlight View
function ScreenShareTile({ stream, presenterName }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play?.().catch(() => {});
    }
  }, [stream]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: '#000' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          backgroundColor: 'rgba(0,0,0,0.7)',
          padding: '6px 14px',
          borderRadius: '8px',
          color: '#e8eaed',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <Monitor size={16} color="#8ab4f8" />
        <span>{presenterName || 'Presenter'} is presenting</span>
      </div>
    </div>
  );
}
