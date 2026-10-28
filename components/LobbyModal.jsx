'use strict';
import React, { useRef, useEffect } from 'react';
import { Mic, MicOff, Video, VideoOff, WifiOff, ShieldCheck, Sparkles, Loader2 } from 'lucide-react';

export default function LobbyModal({
  roomId = '',
  userName = '',
  setUserName = () => {},
  localStream = null,
  audioEnabled = true,
  videoEnabled = true,
  isLowDataMode = false,
  isWaitingForHost = false,
  isDenied = false,
  onToggleAudio = () => {},
  onToggleVideo = () => {},
  onToggleLowData = () => {},
  onJoin = () => {},
  onBackToHome = () => {},
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        backgroundColor: '#202124',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1020px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '40px',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Left: Video Preview Card */}
        <div style={{ flex: '1 1 540px', maxWidth: '640px' }}>
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '380px',
              backgroundColor: '#303134',
              borderRadius: '24px',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Webcam video */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)',
                display: videoEnabled && localStream ? 'block' : 'none',
              }}
            />

            {/* Avatar Fallback if camera off */}
            {(!videoEnabled || !localStream) && (
              <div
                style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  backgroundColor: '#1a73e8',
                  color: '#fff',
                  fontSize: '44px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                }}
              >
                {(userName || 'U').charAt(0).toUpperCase()}
              </div>
            )}

            {/* Bottom floating toggles */}
            <div
              style={{
                position: 'absolute',
                bottom: '16px',
                display: 'flex',
                gap: '16px',
                zIndex: 10,
              }}
            >
              <button
                onClick={onToggleAudio}
                title={audioEnabled ? 'Turn off microphone' : 'Turn on microphone'}
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  backgroundColor: audioEnabled ? 'rgba(60, 64, 67, 0.9)' : '#ea4335',
                  backdropFilter: 'blur(8px)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}
              >
                {audioEnabled ? <Mic size={22} /> : <MicOff size={22} />}
              </button>

              <button
                onClick={onToggleVideo}
                title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  backgroundColor: videoEnabled ? 'rgba(60, 64, 67, 0.9)' : '#ea4335',
                  backdropFilter: 'blur(8px)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}
              >
                {videoEnabled ? <Video size={22} /> : <VideoOff size={22} />}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Join Info & Action Card */}
        <div style={{ flex: '1 1 340px', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {isDenied ? (
            <div
              style={{
                backgroundColor: 'rgba(234, 67, 53, 0.1)',
                border: '1px solid rgba(234, 67, 53, 0.3)',
                padding: '24px',
                borderRadius: '16px',
                textAlign: 'center',
              }}
            >
              <h3 style={{ color: '#ea4335', fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                Entry Denied
              </h3>
              <p style={{ color: '#9aa0a6', fontSize: '14px', marginBottom: '16px' }}>
                The host did not admit you to this meeting.
              </p>
              <button
                onClick={onBackToHome}
                style={{
                  padding: '10px 20px',
                  borderRadius: '24px',
                  backgroundColor: '#3c4043',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                Return to home
              </button>
            </div>
          ) : isWaitingForHost ? (
            <div
              style={{
                backgroundColor: '#303134',
                padding: '32px 24px',
                borderRadius: '20px',
                textAlign: 'center',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}
            >
              <Loader2 size={36} color="#8ab4f8" className="animate-spin" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#e8eaed', marginBottom: '8px' }}>
                Waiting for the host to let you in...
              </h3>
              <p style={{ fontSize: '13px', color: '#9aa0a6' }}>
                Someone in the meeting will let you in shortly.
              </p>
            </div>
          ) : (
            <>
              <div>
                <h2 style={{ fontSize: '28px', fontWeight: '600', color: '#e8eaed', marginBottom: '6px' }}>
                  Ready to join?
                </h2>
                <p style={{ fontSize: '14px', color: '#9aa0a6' }}>
                  Meeting code: <span style={{ color: '#8ab4f8', fontWeight: '500' }}>{roomId}</span>
                </p>
              </div>

              {/* Name Input */}
              <div>
                <label style={{ fontSize: '13px', color: '#9aa0a6', display: 'block', marginBottom: '6px' }}>
                  What's your name?
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Enter your name"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    backgroundColor: '#303134',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#e8eaed',
                    fontSize: '15px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Low Data Mode Switch */}
              <div
                onClick={onToggleLowData}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  backgroundColor: '#303134',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  border: isLowDataMode ? '1px solid #34a853' : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <WifiOff size={18} color={isLowDataMode ? '#81c995' : '#9aa0a6'} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#e8eaed' }}>
                      Low Data Saver
                    </div>
                    <div style={{ fontSize: '11px', color: '#9aa0a6' }}>
                      Optimized for Indian mobile 4G / rural connections
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    width: '36px',
                    height: '20px',
                    backgroundColor: isLowDataMode ? '#34a853' : '#5f6368',
                    borderRadius: '10px',
                    position: 'relative',
                    transition: 'background 0.2s',
                  }}
                >
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      backgroundColor: '#fff',
                      borderRadius: '50%',
                      position: 'absolute',
                      top: '2px',
                      left: isLowDataMode ? '18px' : '2px',
                      transition: 'left 0.2s',
                    }}
                  />
                </div>
              </div>

              {/* Join Button */}
              <button
                onClick={onJoin}
                disabled={!userName.trim()}
                style={{
                  padding: '14px 28px',
                  borderRadius: '28px',
                  backgroundColor: userName.trim() ? '#1a73e8' : '#3c4043',
                  color: userName.trim() ? '#fff' : '#5f6368',
                  fontSize: '16px',
                  fontWeight: '600',
                  boxShadow: userName.trim() ? '0 4px 14px rgba(26, 115, 232, 0.4)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                Join now
              </button>

              {/* Feature highlight badges */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(138, 180, 248, 0.12)',
                    color: '#8ab4f8',
                  }}
                >
                  ⚡ Unlimited Calling
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(52, 168, 83, 0.12)',
                    color: '#81c995',
                  }}
                >
                  🇮🇳 Made for India
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(251, 188, 4, 0.12)',
                    color: '#fbbc04',
                  }}
                >
                  🔒 E2E Encrypted
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
