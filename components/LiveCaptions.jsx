'use strict';
import React, { useState, useEffect, useRef } from 'react';
import { Globe } from 'lucide-react';

export default function LiveCaptions({
  roomId = '',
  socket = null,
  localUserName = 'You',
  enabled = false,
  onCaptionLogged = () => {},
}) {
  const [currentCaption, setCurrentCaption] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('hi-IN');
  const recognitionRef = useRef(null);

  const indianLanguages = [
    { code: 'hi-IN', label: 'हिन्दी (Hindi)' },
    { code: 'en-IN', label: 'English (India)' },
    { code: 'mr-IN', label: 'मराठी (Marathi)' },
    { code: 'ta-IN', label: 'தமிழ் (Tamil)' },
    { code: 'te-IN', label: 'తెలుగు (Telugu)' },
    { code: 'bn-IN', label: 'বাংলা (Bengali)' },
    { code: 'gu-IN', label: 'ગુજરાતી (Gujarati)' },
    { code: 'kn-IN', label: 'ಕನ್ನಡ (Kannada)' },
    { code: 'ml-IN', label: 'മലയാളം (Malayalam)' },
  ];

  // Socket listener for remote captions from other participants
  useEffect(() => {
    if (!socket) return;

    socket.on('new-caption', (caption) => {
      setCurrentCaption(caption);
      onCaptionLogged(caption);
    });

    return () => {
      socket.off('new-caption');
    };
  }, [socket, onCaptionLogged]);

  // Speech Recognition management
  useEffect(() => {
    if (!enabled) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      setCurrentCaption(null);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API not available in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = selectedLanguage;

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const text = finalTranscript || interimTranscript;
      if (text.trim().length > 0) {
        const captionData = {
          senderName: localUserName,
          text: text.trim(),
          lang: selectedLanguage,
          timestamp: Date.now(),
        };

        setCurrentCaption(captionData);
        onCaptionLogged(captionData);

        if (socket && finalTranscript) {
          socket.emit('send-caption', {
            roomId,
            text: finalTranscript.trim(),
            lang: selectedLanguage,
            senderName: localUserName,
          });
        }
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech') {
        console.warn('SpeechRecognition error:', event.error);
      }
    };

    recognition.onend = () => {
      // Auto-restart if captions are still enabled
      if (enabled) {
        try {
          recognition.start();
        } catch (e) {}
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.warn('Could not start recognition:', e);
    }

    return () => {
      try {
        recognition.stop();
      } catch (e) {}
    };
  }, [enabled, selectedLanguage, roomId, socket, localUserName, onCaptionLogged]);

  if (!enabled && !currentCaption) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '96px',
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: '720px',
        width: '90%',
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        pointerEvents: 'auto',
      }}
      className="animate-slide-up"
    >
      {/* Language Selector Pill */}
      {enabled && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(32, 33, 36, 0.9)',
            backdropFilter: 'blur(10px)',
            padding: '4px 10px',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.1)',
            fontSize: '12px',
          }}
        >
          <Globe size={14} color="#8ab4f8" />
          <span style={{ color: '#9aa0a6' }}>Captions:</span>
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#8ab4f8',
              fontSize: '12px',
              fontWeight: '500',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {indianLanguages.map((lang) => (
              <option key={lang.code} value={lang.code} style={{ backgroundColor: '#202124', color: '#e8eaed' }}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Subtitles Overlay */}
      {currentCaption && (
        <div
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(8px)',
            borderRadius: '12px',
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <span
            style={{
              backgroundColor: '#1a73e8',
              color: '#fff',
              fontSize: '11px',
              fontWeight: '600',
              padding: '2px 8px',
              borderRadius: '6px',
              whiteSpace: 'nowrap',
            }}
          >
            {currentCaption.senderName}
          </span>
          <span
            style={{
              fontSize: '15px',
              color: '#fff',
              fontWeight: '400',
              lineHeight: '1.4',
            }}
          >
            {currentCaption.text}
          </span>
        </div>
      )}
    </div>
  );
}
