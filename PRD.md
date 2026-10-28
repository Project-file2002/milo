# 🌟 Milo — Product Requirements Document (PRD)
**Version:** 1.0.0  
**Status:** Approved & Active  
**Author / Team:** Milo Core Engineering Team  
**Last Updated:** October 2026  

---

## 1. Executive Summary & Vision

**Milo** is a modern, 100% free, end-to-end video conferencing platform tailored specifically for Indian internet dynamics and global scale. Inspired by the sleek UX and reliability of Google Meet, Milo eliminates restrictive 40–60 minute call limits and introduces unique Indian-first innovations: **ultra-low data consumption mode**, **real-time multilingual Indian language captions (Hindi, Tamil, Telugu, Marathi, etc.)**, **interactive collaborative Milo Board**, **breakout rooms**, and **automated Gemini AI meeting summaries**.

### Vision Statement
> *"To provide every Indian student, professional, educator, and startup team with world-class, unlimited, lag-free video collaboration without costly subscriptions or restrictive call timeouts."*

---

## 2. Core Value Propositions & Problem Statement

| Problem with Existing Tools (Google Meet / Zoom / Teams) | Milo's Solution |
| :--- | :--- |
| **Strict 40–60 Minute Free Limit** (calls cut off abruptly during important meetings/classes) | **Unlimited Free Calling:** Zero artificial duration caps for 1:1 and group calls. |
| **Heavy Data Consumption:** Rural Indian 4G/3G connections experience stutter, lag, and high data bills. | **'Low Data' Saver Mode:** Automatically caps video bitrate to 120kbps / 15fps or audio-only with dynamic bandwidth throttling. |
| **Language Barriers:** Captions are predominantly English-only; lack of live regional Indian transcriptions. | **Real-Time Multilingual Indian Captions:** Live speech-to-text in Hindi, Marathi, Tamil, Telugu, Bengali, Gujarati, Kannada, and Indian English. |
| **Manual Meeting Minutes:** Taking notes distracts participants from the conversation. | **Milo AI Meeting Assistant:** Generates instant executive summaries, Hindi translations, and action item checklists post-meeting using Gemini API / smart NLP. |
| **Expensive Paid Licenses:** High monthly per-host fees for basic collaboration features. | **100% Free & Open Ecosystem:** Built using standard WebRTC, Next.js, and Socket.io with zero cloud lock-in. |

---

## 3. Target User Personas

1. **Rohan (Startup Founder / Remote Developer in Tier-1/2 City):** Needs fast instant meetings, crystal-clear screen sharing, collaborative whiteboarding, and automated AI action items.
2. **Priya (School / College Teacher in Semi-Urban / Rural India):** Conducts 2-hour long lectures with 50+ students on mobile hotspot networks; needs waiting room approval, mute controls, and zero call drop-offs.
3. **Anand (Regional Business Consultant):** Speaks a blend of Hindi and English; needs live Hindi captions for seamless client communication and exportable meeting transcripts.

---

## 4. Detailed Feature Specifications

### 4.1 Core Video Conferencing Engine
- **WebRTC Mesh & P2P Media:** Direct peer-to-peer audio and video transmission with Google STUN (`stun.l.google.com:19302`).
- **Dynamic Adaptive Video Grid:**
  - Auto-responsive layout (1 tile: full focus; 2 tiles: side-by-side; 3-4 tiles: 2x2; 5-6 tiles: 3x2; 7+: responsive auto-fill).
  - Speaker Spotlight mode and custom tile pinning.
  - Active speaker voice detection via Web Audio API Analyser with glowing halo pulse indicator.
- **Pre-Call Green Room (Lobby):**
  - Live video preview with mic/cam toggles.
  - Real-time mic volume level meter.
  - Name and profile initials customizer.
  - Low Data Mode pre-activation toggle.
- **Global Settings (header gear):**
  - Audio tab: default microphone and speaker selection with a live microphone test meter.
  - Video tab: default camera selection with a mirrored live preview.
  - General tab: display name, start-in-Low-Data default, default captions language, reset to defaults.
  - Preferences persist per browser (`localStorage`) and pre-fill the green room, meeting name, devices, Low Data mode, and captions language.
- **Host Waiting Room & Entry Permissions:**
  - Guests requesting entry enter an approval queue.
  - Host receives toast and banner notification with `[Admit]` and `[Deny]` actions.

### 4.2 Smart & Indian-Tailored Capabilities
- **Low Data Saver Mode:**
  - Throttles video senders to 120 kbps and 15 fps max.
  - Audio bandwidth preserved with Opus codec for crystal-clear voice clarity even on low 3G speeds.
  - Displays persistent "Low Data Mode Active" status badge.
- **Multilingual Real-Time Captions (Live Subtitles):**
  - Integrated with Web Speech API (`webkitSpeechRecognition`).
  - Supported Indian Languages: Hindi (`hi-IN`), Indian English (`en-IN`), Marathi (`mr-IN`), Tamil (`ta-IN`), Telugu (`te-IN`), Bengali (`bn-IN`), Gujarati (`gu-IN`), Kannada (`kn-IN`), Malayalam (`ml-IN`).
  - Live socket broadcasting of subtitle events across the room with speaker tag.
- **Milo AI Meeting Notes & Action Items:**
  - Captures full speech transcript and chat log throughout the meeting.
  - Post-call or on-demand generation using the Gemini Flash API (model configurable via `GEMINI_MODEL`, default `gemini-2.5-flash`) with a smart local NLP fallback engine.
  - Outputs:
    1. Executive Overview in English and Hindi (`संक्षेप`)
    2. Key Decisions & Discussion Topics
    3. Action Items Checklist with owners
    4. One-click Copy and Markdown (`.md`) export.

### 4.3 Collaboration & Engagement Tools
- **Milo Board (Collaborative Whiteboard):**
  - HTML5 Canvas drawing synced in real-time across peers.
  - Pen, highlighter, eraser, color palette (Google Blue, Red, Yellow, Green, Purple, White).
  - Line thickness control and canvas clearing.
  - Export sketch to high-resolution PNG image.
- **Screen Sharing (Present Now):**
  - Full screen, single application window, or browser tab with system audio.
  - Smooth WebRTC video track replacement without tearing down peer connections.
- **Interactive Reactions & Celebration:**
  - Floating emoji tray: ❤️, 👍, 👏, 😂, 😮, 😢, 🎉, 🔥.
  - Full-screen particle confetti animation triggered by party popper reaction (`🎉`).
- **In-Call Real-Time Chat:**
  - Ephemeral chat log with sender identification, host badges, and timestamps.
  - URL link auto-detection.
- **Breakout Rooms:**
  - Host capability to split large calls into 2, 3, or more breakout rooms.
  - Seamless movement of peers between rooms and one-click recall to main room.

---

## 5. Non-Functional Requirements (NFRs)

1. **Latency & Performance:** WebRTC end-to-end audio/video latency < 200ms across domestic Indian routes.
2. **Bandwidth Optimization:** Standard HD mode: ~1.2–1.5 Mbps; Low Data mode: ≤ 150 kbps.
3. **Compatibility:** Desktop & Mobile browsers (Chrome, Edge, Firefox, Safari, Brave, Samsung Internet).
4. **Data Privacy & Security:**
   - Ephemeral in-memory socket rooms (no recording or message persistence on disk without user consent).
   - Compliant with Indian Information Technology (IT) Rules & Digital Personal Data Protection (DPDP) principles.
5. **Token & Developer Efficiency:** Clean modular codebase following Next.js App Router conventions with zero unnecessary bloat.
