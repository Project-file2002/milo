'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Video,
  Keyboard,
  Link2,
  Plus,
  Calendar,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  WifiOff,
  Sparkles,
  Subtitles,
  PenTool,
  Clock
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [meetingCode, setMeetingCode] = useState('');
  const [showNewMeetingMenu, setShowNewMeetingMenu] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [createdRoomLink, setCreatedRoomLink] = useState('');
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Update real-time clock and date
  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setCurrentDate(
        now.toLocaleDateString('en-IN', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      );
    };
    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Generate Google Meet format random room code (e.g. "abc-defg-hij")
  const generateRoomCode = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    const segment = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${segment(3)}-${segment(4)}-${segment(3)}`;
  };

  // Start Instant Meeting
  const startInstantMeeting = () => {
    const code = generateRoomCode();
    router.push(`/meet/${code}?host=true`);
  };

  // Create meeting for later
  const createMeetingForLater = () => {
    const code = generateRoomCode();
    const link = `${window.location.origin}/meet/${code}`;
    setCreatedRoomLink(link);
    setShowLinkModal(true);
    setShowNewMeetingMenu(false);
  };

  // Join meeting with code or link
  const handleJoin = (e) => {
    e?.preventDefault();
    if (!meetingCode.trim()) return;

    let code = meetingCode.trim();
    // Handle full URL pasted
    if (code.includes('/meet/')) {
      code = code.split('/meet/')[1].split('?')[0];
    }
    router.push(`/meet/${code}`);
  };

  const copyCreatedLink = () => {
    navigator.clipboard.writeText(createdRoomLink).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  // Slides for Carousel
  const slides = [
    {
      title: 'Unlimited HD Video & Low Data Saver',
      description: 'Host calls with up to 500 participants without any 60-minute time cap. Features specialized data saver mode for rural and mobile internet.',
      icon: <WifiOff size={48} color="#81c995" />,
      badge: 'Zero Time Restrictions',
      bg: 'linear-gradient(135deg, rgba(52, 168, 83, 0.15), rgba(26, 115, 232, 0.15))',
    },
    {
      title: 'Real-Time Indian Language Captions',
      description: 'Break language barriers with live speech-to-text in Hindi, Marathi, Tamil, Telugu, and Indian English directly during your video call.',
      icon: <Subtitles size={48} color="#8ab4f8" />,
      badge: 'Multilingual Speech-to-Text',
      bg: 'linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(161, 66, 244, 0.15))',
    },
    {
      title: 'Interactive Milo Board & Breakout Rooms',
      description: 'Collaborate visually on a shared real-time canvas and split teams into interactive breakout rooms for focused brainstorming.',
      icon: <PenTool size={48} color="#fbbc04" />,
      badge: 'Visual Collaboration',
      bg: 'linear-gradient(135deg, rgba(251, 188, 4, 0.15), rgba(234, 67, 53, 0.15))',
    },
    {
      title: 'Smart AI Meeting Summaries with Gemini',
      description: 'Automatically transcribe conversations, extract key takeaways, and generate comprehensive action item summaries with one click.',
      icon: <Sparkles size={48} color="#d7aefb" />,
      badge: 'AI Powered Assistant',
      bg: 'linear-gradient(135deg, rgba(161, 66, 244, 0.2), rgba(26, 115, 232, 0.2))',
    },
  ];

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#202124', color: '#e8eaed', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <header
        style={{
          height: '64px',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        {/* Logo and Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #1a73e8, #34a853)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(26, 115, 232, 0.4)',
            }}
          >
            <Video size={22} color="#fff" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '22px', fontWeight: '500', letterSpacing: '-0.5px', color: '#fff' }}>
              Milo
            </span>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: '#9aa0a6',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              🇮🇳 Made for India
            </span>
          </div>
        </div>

        {/* Right Header Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '15px', color: '#9aa0a6', fontWeight: '400' }}>
            {currentTime} • {currentDate}
          </div>

          <button
            title="Settings"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9aa0a6',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#303134')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Settings size={20} />
          </button>

          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: '#1a73e8',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '600',
              fontSize: '15px',
            }}
          >
            A
          </div>
        </div>
      </header>

      {/* Main Hero & Content Area */}
      <main
        style={{
          flex: 1,
          maxWidth: '1280px',
          width: '100%',
          margin: '0 auto',
          padding: '60px 32px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '48px',
        }}
      >
        {/* Left Column: Action & Headline */}
        <div style={{ flex: '1 1 540px', maxWidth: '600px' }}>
          <h1
            style={{
              fontSize: '44px',
              fontWeight: '400',
              lineHeight: '1.2',
              color: '#e8eaed',
              marginBottom: '18px',
              letterSpacing: '-0.5px',
            }}
          >
            Premium video meetings. <br />
            <span style={{ color: '#8ab4f8' }}>Now free for everyone.</span>
          </h1>

          <p
            style={{
              fontSize: '17px',
              lineHeight: '1.6',
              color: '#9aa0a6',
              marginBottom: '36px',
            }}
          >
            We re-engineered video conferencing for Indian internet speeds and global teams.
            Enjoy unlimited call duration, data-saver mode, live regional language captions, and AI notes.
          </p>

          {/* Action Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', position: 'relative' }}>
            {/* New Meeting Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowNewMeetingMenu(!showNewMeetingMenu)}
                style={{
                  height: '48px',
                  padding: '0 20px',
                  borderRadius: '24px',
                  backgroundColor: '#1a73e8',
                  color: '#fff',
                  fontSize: '15px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 10px rgba(26, 115, 232, 0.3)',
                  transition: 'background 0.2s',
                }}
              >
                <Video size={18} />
                <span>New meeting</span>
              </button>

              {/* Dropdown Menu */}
              {showNewMeetingMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '56px',
                    left: 0,
                    backgroundColor: '#303134',
                    borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    width: '260px',
                    padding: '8px 0',
                    zIndex: 50,
                  }}
                  className="animate-slide-up"
                >
                  <button
                    onClick={createMeetingForLater}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      color: '#e8eaed',
                      fontSize: '14px',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#3c4043')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Link2 size={18} color="#8ab4f8" />
                    <span>Create a meeting for later</span>
                  </button>

                  <button
                    onClick={startInstantMeeting}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      color: '#e8eaed',
                      fontSize: '14px',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#3c4043')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Plus size={18} color="#8ab4f8" />
                    <span>Start an instant meeting</span>
                  </button>
                </div>
              )}
            </div>

            {/* Enter Code Input */}
            <form onSubmit={handleJoin} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Keyboard
                  size={18}
                  color="#9aa0a6"
                  style={{ position: 'absolute', left: '14px', pointerEvents: 'none' }}
                />
                <input
                  type="text"
                  placeholder="Enter a code or link"
                  value={meetingCode}
                  onChange={(e) => setMeetingCode(e.target.value)}
                  style={{
                    height: '48px',
                    padding: '0 16px 0 42px',
                    backgroundColor: '#303134',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    fontSize: '15px',
                    color: '#e8eaed',
                    outline: 'none',
                    width: '230px',
                  }}
                />
              </div>

              {meetingCode.trim() && (
                <button
                  type="submit"
                  style={{
                    height: '48px',
                    padding: '0 20px',
                    borderRadius: '8px',
                    color: '#8ab4f8',
                    fontSize: '15px',
                    fontWeight: '600',
                  }}
                >
                  Join
                </button>
              )}
            </form>
          </div>

          {/* Under-action divider */}
          <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontSize: '14px', color: '#9aa0a6' }}>
              <strong style={{ color: '#81c995' }}>✓ 100% Free</strong> with no subscriptions, ads, or time limits.
            </span>
          </div>
        </div>

        {/* Right Column: Interactive Feature Carousel */}
        <div style={{ flex: '1 1 480px', maxWidth: '520px' }}>
          <div
            style={{
              position: 'relative',
              backgroundColor: '#28292c',
              borderRadius: '24px',
              padding: '36px 32px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 12px 36px rgba(0,0,0,0.4)',
              minHeight: '380px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            {/* Slide Header */}
            <div>
              <div
                style={{
                  width: '84px',
                  height: '84px',
                  borderRadius: '20px',
                  background: slides[currentSlide].bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '24px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                }}
              >
                {slides[currentSlide].icon}
              </div>

              <span
                style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#8ab4f8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  display: 'block',
                  marginBottom: '8px',
                }}
              >
                {slides[currentSlide].badge}
              </span>

              <h3 style={{ fontSize: '22px', fontWeight: '500', color: '#e8eaed', marginBottom: '12px' }}>
                {slides[currentSlide].title}
              </h3>

              <p style={{ fontSize: '15px', color: '#9aa0a6', lineHeight: '1.6' }}>
                {slides[currentSlide].description}
              </p>
            </div>

            {/* Carousel Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '24px' }}>
              {/* Dots */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {slides.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentSlide(idx)}
                    style={{
                      width: currentSlide === idx ? '24px' : '8px',
                      height: '8px',
                      borderRadius: '4px',
                      backgroundColor: currentSlide === idx ? '#8ab4f8' : '#5f6368',
                      transition: 'all 0.3s ease',
                    }}
                  />
                ))}
              </div>

              {/* Prev / Next Buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={prevSlide}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: '#3c4043',
                    color: '#e8eaed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={nextSlide}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: '#3c4043',
                    color: '#e8eaed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modal: Meeting link created for later */}
      {showLinkModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 100,
          }}
          className="animate-fade-in"
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: '#303134',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <h3 style={{ fontSize: '20px', fontWeight: '500', color: '#e8eaed', marginBottom: '8px' }}>
              Here's the link to your meeting
            </h3>
            <p style={{ fontSize: '14px', color: '#9aa0a6', marginBottom: '20px', lineHeight: '1.5' }}>
              Copy this link and send it to people you want to meet with. Be sure to save it so you can use it later, too.
            </p>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: '#202124',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.08)',
                marginBottom: '20px',
              }}
            >
              <span style={{ fontSize: '14px', color: '#8ab4f8', wordBreak: 'break-all' }}>
                {createdRoomLink}
              </span>
              <button
                onClick={copyCreatedLink}
                style={{
                  color: copiedLink ? '#81c995' : '#e8eaed',
                  padding: '6px',
                  borderRadius: '6px',
                }}
              >
                {copiedLink ? 'Copied!' : <Link2 size={18} />}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setShowLinkModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  color: '#9aa0a6',
                  fontSize: '14px',
                }}
              >
                Close
              </button>
              <button
                onClick={() => router.push(createdRoomLink)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '6px',
                  backgroundColor: '#1a73e8',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                Join Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
