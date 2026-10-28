'use strict';
import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Send,
  Users,
  MessageSquare,
  Info,
  Sparkles,
  ShieldCheck,
  Grid,
  MicOff,
  UserCheck,
  UserX,
  Download,
  Share2
} from 'lucide-react';

export default function SidePanel({
  activePanel,
  roomId = '',
  isHost = false,
  localUser = {},
  participants = [],
  waitingList = [],
  chatMessages = [],
  breakoutRooms = [],
  captionsLog = [],
  onClose = () => {},
  onSendMessage = () => {},
  onHostLobbyDecision = () => {},
  onCreateBreakout = () => {},
  onAssignBreakout = () => {},
  onCloseBreakout = () => {},
}) {
  const [copied, setCopied] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [userGeminiKey, setUserGeminiKey] = useState('');
  const chatBottomRef = useRef(null);

  useEffect(() => {
    if (activePanel === 'chat' && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activePanel]);

  if (!activePanel) return null;

  const meetingUrl = typeof window !== 'undefined' ? `${window.location.origin}/meet/${roomId}` : '';

  const copyMeetingInfo = () => {
    navigator.clipboard.writeText(meetingUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendMessage(chatInput.trim());
    setChatInput('');
  };

  const generateMeetingSummary = async () => {
    setGeneratingSummary(true);
    try {
      const res = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingTitle: `Milo Meeting (${roomId})`,
          captionsLog,
          chatMessages,
          participants: [localUser, ...participants],
          apiKey: userGeminiKey.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAiSummary(data.summary);
      } else {
        setAiSummary('Failed to generate summary. Please try again.');
      }
    } catch (err) {
      setAiSummary('Error generating summary. Please check your network connection.');
    } finally {
      setGeneratingSummary(false);
    }
  };

  const allAttendees = [localUser, ...participants];
  const filteredAttendees = allAttendees.filter((u) =>
    (u?.userName || '').toLowerCase().includes(searchUser.toLowerCase())
  );

  return (
    <div
      style={{
        width: '360px',
        height: '100%',
        backgroundColor: '#28292c',
        borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 40,
        boxShadow: '-4px 0 16px rgba(0,0,0,0.3)',
      }}
      className="animate-slide-right"
    >
      {/* Panel Header */}
      <div
        style={{
          height: '64px',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <h3 style={{ fontSize: '18px', fontWeight: '500', color: '#e8eaed', textTransform: 'capitalize' }}>
          {activePanel === 'info' && 'Meeting Details'}
          {activePanel === 'users' && `People (${allAttendees.length})`}
          {activePanel === 'chat' && 'In-call Messages'}
          {activePanel === 'breakout' && 'Breakout Rooms'}
          {activePanel === 'ai' && 'Milo AI Notes'}
          {activePanel === 'host' && 'Host Controls'}
        </h3>
        <button
          onClick={onClose}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9aa0a6',
          }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Panel Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {/* 1. INFO TAB */}
        {activePanel === 'info' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <p style={{ fontSize: '13px', color: '#9aa0a6', marginBottom: '8px' }}>Joining Info</p>
              <div
                style={{
                  backgroundColor: '#202124',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  fontSize: '13px',
                  color: '#8ab4f8',
                  wordBreak: 'break-all',
                  marginBottom: '12px',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {meetingUrl}
              </div>
              <button
                onClick={copyMeetingInfo}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#1a73e8',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: '500',
                  width: '100%',
                  justifyContent: 'center',
                }}
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                <span>{copied ? 'Link Copied!' : 'Copy joining info'}</span>
              </button>
            </div>

            <div style={{ padding: '16px', backgroundColor: '#202124', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#81c995', marginBottom: '8px' }}>
                <ShieldCheck size={18} />
                <span style={{ fontSize: '14px', fontWeight: '500' }}>Privacy & Security First</span>
              </div>
              <p style={{ fontSize: '12px', color: '#9aa0a6', lineHeight: '1.5' }}>
                End-to-end encrypted direct peer connections. Unlimited meeting duration with no cut-off time. Made with ❤️ in India 🇮🇳.
              </p>
            </div>
          </div>
        )}

        {/* 2. USERS (PEOPLE) TAB */}
        {activePanel === 'users' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Waiting Room Section for Host */}
            {isHost && waitingList.length > 0 && (
              <div
                style={{
                  backgroundColor: 'rgba(251, 188, 4, 0.1)',
                  border: '1px solid rgba(251, 188, 4, 0.3)',
                  borderRadius: '12px',
                  padding: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#fbbc04' }}>
                    Waiting Room ({waitingList.length})
                  </span>
                </div>
                {waitingList.map((guest) => (
                  <div
                    key={guest.peerId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <span style={{ fontSize: '13px', color: '#e8eaed' }}>{guest.userName}</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => onHostLobbyDecision(guest.peerId, true)}
                        style={{
                          backgroundColor: '#34a853',
                          color: '#fff',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                        }}
                      >
                        Admit
                      </button>
                      <button
                        onClick={() => onHostLobbyDecision(guest.peerId, false)}
                        style={{
                          backgroundColor: '#ea4335',
                          color: '#fff',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                        }}
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* User Search */}
            <input
              type="text"
              placeholder="Search people..."
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                backgroundColor: '#202124',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#e8eaed',
                fontSize: '14px',
              }}
            />

            {/* Attendees List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredAttendees.map((user, idx) => (
                <div
                  key={user?.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#202124',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: '#1a73e8',
                        color: '#fff',
                        fontSize: '14px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {(user?.userName || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#e8eaed' }}>
                        {user?.userName} {user?.id === localUser?.id ? '(You)' : ''}
                      </div>
                      <div style={{ fontSize: '11px', color: '#9aa0a6' }}>
                        {user?.isHost ? 'Meeting Host' : 'Participant'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {user?.handRaised && <span style={{ fontSize: '14px' }}>✋</span>}
                    {user?.audio === false && <MicOff size={16} color="#ea4335" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. CHAT TAB */}
        {activePanel === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div
              style={{
                backgroundColor: '#202124',
                padding: '10px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#9aa0a6',
                marginBottom: '12px',
                textAlign: 'center',
              }}
            >
              Messages are visible only to people in the call and are deleted when the call ends.
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {chatMessages.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#5f6368', fontSize: '13px', marginTop: '40px' }}>
                  No messages yet. Say hello!
                </p>
              ) : (
                chatMessages.map((msg) => (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#8ab4f8' }}>
                        {msg.senderName}
                      </span>
                      {msg.isHost && (
                        <span
                          style={{
                            fontSize: '9px',
                            backgroundColor: '#1a73e8',
                            color: '#fff',
                            padding: '1px 4px',
                            borderRadius: '4px',
                          }}
                        >
                          HOST
                        </span>
                      )}
                      <span style={{ fontSize: '11px', color: '#5f6368' }}>{msg.timestamp}</span>
                    </div>
                    <div
                      style={{
                        backgroundColor: '#202124',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: '#e8eaed',
                        lineHeight: '1.4',
                        wordBreak: 'break-word',
                      }}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <input
                type="text"
                placeholder="Send a message to everyone"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                style={{
                  flex: 1,
                  backgroundColor: '#202124',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '24px',
                  padding: '10px 16px',
                  color: '#e8eaed',
                  fontSize: '13px',
                }}
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: chatInput.trim() ? '#8ab4f8' : '#3c4043',
                  color: chatInput.trim() ? '#202124' : '#5f6368',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        )}

        {/* 4. BREAKOUT ROOMS TAB */}
        {activePanel === 'breakout' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '13px', color: '#9aa0a6' }}>
              Split participants into smaller group discussions for team brainstorms or workshops.
            </p>

            {isHost ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => onCreateBreakout(2)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      backgroundColor: '#1a73e8',
                      color: '#fff',
                      fontSize: '13px',
                      fontWeight: '500',
                    }}
                  >
                    Create 2 Rooms
                  </button>
                  <button
                    onClick={() => onCreateBreakout(3)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      backgroundColor: '#1a73e8',
                      color: '#fff',
                      fontSize: '13px',
                      fontWeight: '500',
                    }}
                  >
                    Create 3 Rooms
                  </button>
                </div>

                {breakoutRooms.length > 0 && (
                  <button
                    onClick={onCloseBreakout}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      backgroundColor: '#ea4335',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  >
                    Close All Breakout Rooms
                  </button>
                )}
              </div>
            ) : (
              <p style={{ fontSize: '12px', color: '#5f6368' }}>Only the meeting host can configure breakout rooms.</p>
            )}

            {breakoutRooms.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                {breakoutRooms.map((room) => (
                  <div
                    key={room.id}
                    style={{
                      padding: '12px',
                      backgroundColor: '#202124',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#e8eaed' }}>{room.name}</div>
                    <div style={{ fontSize: '12px', color: '#9aa0a6', marginTop: '4px' }}>
                      {room.participants?.length || 0} participants
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. AI NOTES & SUMMARY TAB */}
        {activePanel === 'ai' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(161, 66, 244, 0.2), rgba(26, 115, 232, 0.2))',
                border: '1px solid rgba(161, 66, 244, 0.4)',
                borderRadius: '12px',
                padding: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#d7aefb', marginBottom: '6px' }}>
                <Sparkles size={18} />
                <span style={{ fontSize: '14px', fontWeight: '600' }}>Smart AI Meeting Assistant</span>
              </div>
              <p style={{ fontSize: '12px', color: '#e8eaed', lineHeight: '1.4' }}>
                Milo AI automatically transcribes speech, highlights key points, assigns action items, and generates summaries in English & Hindi.
              </p>
            </div>

            {/* Optional Gemini API Key input */}
            <div>
              <label style={{ fontSize: '12px', color: '#9aa0a6', display: 'block', marginBottom: '4px' }}>
                Gemini API Key (Optional for cloud LLM model):
              </label>
              <input
                type="password"
                placeholder="AIzaSy... (leave blank for built-in Milo engine)"
                value={userGeminiKey}
                onChange={(e) => setUserGeminiKey(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: '#202124',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#e8eaed',
                }}
              />
            </div>

            <button
              onClick={generateMeetingSummary}
              disabled={generatingSummary}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '8px',
                background: 'linear-gradient(90deg, #a142f4, #1a73e8)',
                color: '#fff',
                fontSize: '13px',
                fontWeight: '600',
              }}
            >
              <Sparkles size={16} />
              <span>{generatingSummary ? 'Analyzing Discussion...' : 'Generate AI Summary Now'}</span>
            </button>

            {/* AI Summary Output Display */}
            {aiSummary && (
              <div
                style={{
                  backgroundColor: '#202124',
                  padding: '14px',
                  borderRadius: '12px',
                  fontSize: '13px',
                  color: '#e8eaed',
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.5',
                  border: '1px solid rgba(255,255,255,0.08)',
                  maxHeight: '360px',
                  overflowY: 'auto',
                }}
              >
                {aiSummary}
              </div>
            )}
          </div>
        )}

        {/* 6. HOST CONTROLS TAB */}
        {activePanel === 'host' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '13px', color: '#9aa0a6' }}>
              Use host settings to manage permissions, entry approval, and participant audio/video.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#202124',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '14px', color: '#e8eaed' }}>Waiting Room (Lobby)</div>
                  <div style={{ fontSize: '11px', color: '#9aa0a6' }}>Require approval before guests join</div>
                </div>
                <span style={{ fontSize: '12px', color: '#81c995', fontWeight: '600' }}>ENABLED</span>
              </div>

              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#202124',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '14px', color: '#e8eaed' }}>Screen Share Permission</div>
                  <div style={{ fontSize: '11px', color: '#9aa0a6' }}>Allow everyone to present screen</div>
                </div>
                <span style={{ fontSize: '12px', color: '#81c995', fontWeight: '600' }}>ALLOWED</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
