'use strict';
import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Subtitles,
  Smile,
  Monitor,
  Hand,
  PenTool,
  MoreVertical,
  PhoneOff,
  Info,
  Users,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  Wifi,
  WifiOff,
  Maximize2,
  Minimize2,
  Grid
} from 'lucide-react';

export default function ControlBar({
  roomId = '',
  audioEnabled = true,
  videoEnabled = true,
  captionsEnabled = false,
  handRaised = false,
  isScreenSharing = false,
  isWhiteboardOpen = false,
  isLowDataMode = false,
  isHost = false,
  activePanel = null, // 'info' | 'users' | 'chat' | 'breakout' | 'ai' | null
  participantCount = 1,
  unreadCount = 0,
  onToggleAudio = () => {},
  onToggleVideo = () => {},
  onToggleCaptions = () => {},
  onToggleHand = () => {},
  onToggleScreenShare = () => {},
  onToggleWhiteboard = () => {},
  onToggleLowData = () => {},
  onTogglePanel = () => {},
  onSendReaction = () => {},
  onLeaveMeeting = () => {},
}) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const emojis = ['💖', '👍', '👏', '😂', '😮', '😢', '🎉', '🔥'];

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '80px',
        backgroundColor: '#202124',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        zIndex: 50,
      }}
    >
      {/* Left: Meeting ID & Time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: '180px' }}>
        <span style={{ fontSize: '15px', fontWeight: '500', color: '#e8eaed' }}>{currentTime}</span>
        <span style={{ color: '#5f6368' }}>|</span>
        <span style={{ fontSize: '14px', color: '#9aa0a6', letterSpacing: '0.3px', fontWeight: '500' }}>
          {roomId}
        </span>
      </div>

      {/* Center: Main Floating Control Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
        {/* Mic Button */}
        <button
          onClick={onToggleAudio}
          title={audioEnabled ? 'Turn off microphone' : 'Turn on microphone'}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: audioEnabled ? '#3c4043' : '#ea4335',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s',
          }}
        >
          {audioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
        </button>

        {/* Video Button */}
        <button
          onClick={onToggleVideo}
          title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: videoEnabled ? '#3c4043' : '#ea4335',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s',
          }}
        >
          {videoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
        </button>

        {/* Captions Button */}
        <button
          onClick={onToggleCaptions}
          title={captionsEnabled ? 'Turn off captions' : 'Turn on captions (Hindi & Indian languages supported)'}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: captionsEnabled ? '#8ab4f8' : '#3c4043',
            color: captionsEnabled ? '#202124' : '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
        >
          <Subtitles size={20} />
        </button>

        {/* Emoji Reactions Button */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Send a reaction"
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: showEmojiPicker ? '#8ab4f8' : '#3c4043',
              color: showEmojiPicker ? '#202124' : '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
          >
            <Smile size={20} />
          </button>

          {/* Reaction Tray Popup */}
          {showEmojiPicker && (
            <div
              style={{
                position: 'absolute',
                bottom: '60px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: '#303134',
                padding: '8px 12px',
                borderRadius: '24px',
                display: 'flex',
                gap: '8px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.1)',
                zIndex: 60,
              }}
            >
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onSendReaction(emoji);
                    setShowEmojiPicker(false);
                  }}
                  style={{
                    fontSize: '22px',
                    padding: '4px',
                    borderRadius: '8px',
                    transition: 'transform 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.25)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Screen Share Button */}
        <button
          onClick={onToggleScreenShare}
          title={isScreenSharing ? 'Stop presenting' : 'Present now'}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: isScreenSharing ? '#8ab4f8' : '#3c4043',
            color: isScreenSharing ? '#202124' : '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
        >
          <Monitor size={20} />
        </button>

        {/* Raise Hand Button */}
        <button
          onClick={onToggleHand}
          title={handRaised ? 'Lower hand' : 'Raise hand'}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: handRaised ? '#fbbc04' : '#3c4043',
            color: handRaised ? '#202124' : '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
        >
          <Hand size={20} />
        </button>

        {/* Milo Board Collaborative Whiteboard Button */}
        <button
          onClick={onToggleWhiteboard}
          title={isWhiteboardOpen ? 'Close Milo Board' : 'Open Collaborative Milo Board'}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: isWhiteboardOpen ? '#8ab4f8' : '#3c4043',
            color: isWhiteboardOpen ? '#202124' : '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
        >
          <PenTool size={20} />
        </button>

        {/* More Options Menu Button */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            title="More options"
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: showMoreMenu ? '#8ab4f8' : '#3c4043',
              color: showMoreMenu ? '#202124' : '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
          >
            <MoreVertical size={20} />
          </button>

          {/* More Options Dropdown */}
          {showMoreMenu && (
            <div
              style={{
                position: 'absolute',
                bottom: '60px',
                right: '0',
                backgroundColor: '#303134',
                padding: '8px 0',
                borderRadius: '12px',
                minWidth: '220px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                border: '1px solid rgba(255,255,255,0.1)',
                zIndex: 60,
              }}
            >
              <button
                onClick={() => {
                  onToggleLowData();
                  setShowMoreMenu(false);
                }}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  color: isLowDataMode ? '#81c995' : '#e8eaed',
                  fontSize: '14px',
                  textAlign: 'left',
                }}
              >
                {isLowDataMode ? <WifiOff size={18} color="#81c995" /> : <Wifi size={18} />}
                <span>{isLowDataMode ? 'Disable Low Data Saver' : 'Enable Low Data Saver'}</span>
              </button>

              <button
                onClick={() => {
                  onTogglePanel('breakout');
                  setShowMoreMenu(false);
                }}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  color: '#e8eaed',
                  fontSize: '14px',
                  textAlign: 'left',
                }}
              >
                <Grid size={18} />
                <span>Breakout Rooms</span>
              </button>

              <button
                onClick={() => {
                  toggleFullscreen();
                  setShowMoreMenu(false);
                }}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  color: '#e8eaed',
                  fontSize: '14px',
                  textAlign: 'left',
                }}
              >
                {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                <span>{isFullscreen ? 'Exit full screen' : 'Full screen'}</span>
              </button>
            </div>
          )}
        </div>

        {/* End Call Button */}
        <button
          onClick={onLeaveMeeting}
          title="Leave call"
          style={{
            height: '48px',
            padding: '0 24px',
            borderRadius: '24px',
            backgroundColor: '#ea4335',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: '600',
            boxShadow: '0 2px 8px rgba(234, 67, 53, 0.4)',
            transition: 'background 0.2s',
          }}
        >
          <PhoneOff size={20} />
          <span>Leave</span>
        </button>
      </div>

      {/* Right: Info, People, Chat, AI Notes */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Info */}
        <button
          onClick={() => onTogglePanel(activePanel === 'info' ? null : 'info')}
          title="Meeting details"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: activePanel === 'info' ? '#8ab4f8' : 'transparent',
            color: activePanel === 'info' ? '#202124' : '#e8eaed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Info size={20} />
        </button>

        {/* People List */}
        <button
          onClick={() => onTogglePanel(activePanel === 'users' ? null : 'users')}
          title="People"
          style={{
            position: 'relative',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: activePanel === 'users' ? '#8ab4f8' : 'transparent',
            color: activePanel === 'users' ? '#202124' : '#e8eaed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Users size={20} />
          {participantCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '2px',
                right: '2px',
                fontSize: '10px',
                backgroundColor: activePanel === 'users' ? '#202124' : '#8ab4f8',
                color: activePanel === 'users' ? '#fff' : '#202124',
                fontWeight: '700',
                borderRadius: '8px',
                padding: '1px 5px',
              }}
            >
              {participantCount}
            </span>
          )}
        </button>

        {/* Chat */}
        <button
          onClick={() => onTogglePanel(activePanel === 'chat' ? null : 'chat')}
          title="Chat with everyone"
          style={{
            position: 'relative',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: activePanel === 'chat' ? '#8ab4f8' : 'transparent',
            color: activePanel === 'chat' ? '#202124' : '#e8eaed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MessageSquare size={20} />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '2px',
                right: '2px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#ea4335',
              }}
            />
          )}
        </button>

        {/* AI Notes / Summary */}
        <button
          onClick={() => onTogglePanel(activePanel === 'ai' ? null : 'ai')}
          title="Milo AI Notes & Summary"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: activePanel === 'ai' ? '#8ab4f8' : 'rgba(161, 66, 244, 0.2)',
            color: activePanel === 'ai' ? '#202124' : '#d7aefb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(161, 66, 244, 0.4)',
          }}
        >
          <Sparkles size={20} />
        </button>

        {/* Host Controls */}
        {isHost && (
          <button
            onClick={() => onTogglePanel(activePanel === 'host' ? null : 'host')}
            title="Host management & Lobby"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: activePanel === 'host' ? '#8ab4f8' : 'transparent',
              color: activePanel === 'host' ? '#202124' : '#81c995',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheck size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
