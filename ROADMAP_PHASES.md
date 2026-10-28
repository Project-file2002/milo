# 🗺️ Milo — Implementation Roadmap & Progress Tracker

This document tracks the phased implementation of the **Milo** video conferencing application. Agents and developers must check off tasks (`[x]`) as each phase is completed and verified against the acceptance criteria.

---

## 📊 Overall Progress Summary

| Phase | Description | Status | Completion |
| :--- | :--- | :---: | :---: |
| **Phase 1** | Foundation, Next.js Custom Server & Design System | ✅ Completed | 100% |
| **Phase 2** | WebRTC Mesh Video Engine & Google Meet UI Grid | ✅ Completed | 100% |
| **Phase 3** | Indian-Tailored Features (Low Data Mode & Live Hindi Captions) | ✅ Completed | 100% |
| **Phase 4** | Interactive Collaboration (Milo Board, Chat & Reactions) | ✅ Completed | 100% |
| **Phase 5** | Host Security, Waiting Room / Lobby & Breakout Rooms | ✅ Completed | 100% |
| **Phase 6** | Milo AI Meeting Assistant (Gemini Notes & Summary Export) | ✅ Completed | 100% |
| **Phase 7** | Multi-Peer Automated E2E Verification & Browser Testing | 🔄 In Progress | 75% |
| **Phase 8** | Mediasoup / LiveKit SFU Scaling for 100+ Stream Webinars | 📋 Planned | 0% |

---

## 🚀 Phase-by-Phase Breakdown

### Phase 1: Project Scaffolding & Unified Server
- [x] Initialize Next.js App Router workspace with Node v24 support.
- [x] Configure custom `server.js` using Node HTTP + Socket.io running on a unified port (`3000`).
- [x] Implement room session memory store (`rooms` map with participants, waiting list, whiteboard strokes).
- [x] Build Google Meet Material 3 Dark theme design tokens in `app/globals.css`.
- [x] Build SEO-optimized `app/layout.jsx` with Indian regional meta-tags.
- [x] Verify server starts cleanly with `node server.js` with zero ES module warnings.

**Acceptance Verification:** Server boots at `http://localhost:3000` with WebSocket upgrade handling active.

---

### Phase 2: WebRTC Mesh Video Engine & Google Meet Layout
- [x] Create `lib/webrtc.js` with Google STUN configuration (`stun.l.google.com:19302`).
- [x] Implement WebRTC Mesh negotiation (`initiateOffer`, `handleSignal`, ICE candidate routing).
- [x] Build `components/VideoGrid.jsx` with responsive layouts:
  - [x] 1-person full screen tile
  - [x] 2-person side-by-side grid
  - [x] 3-4 person 2x2 grid
  - [x] 5-6 person 3x2 grid
  - [x] 7+ person auto-filling dynamic grid
- [x] Implement active speaker detection via Web Audio API `AudioContext` and `AnalyserNode` with glowing border.
- [x] Build tile spotlight pinning mode (`Pin` / `PinOff`).
- [x] Implement screen sharing (`getDisplayMedia`) with seamless video track swapping.
- [x] Build Google Meet floating bottom control bar (`components/ControlBar.jsx`) with mic, cam, end call, and side panel triggers.

**Acceptance Verification:** Two or more browser tabs can join the same room and stream 2-way video and audio in real time.

---

### Phase 3: Indian-Tailored Capabilities
- [x] **'Low Data' Saver Mode:**
  - [x] Add bitrate throttling logic in `lib/webrtc.js` (`maxBitrate: 120000`, `maxFramerate: 15`).
  - [x] Add Low Data mode switch in ControlBar more menu and pre-call Lobby.
  - [x] Render persistent status tag on participant video tiles.
- [x] **Live Multilingual Captions:**
  - [x] Build `components/LiveCaptions.jsx` with browser `webkitSpeechRecognition`.
  - [x] Add regional Indian language selector:
    - [x] Hindi (`hi-IN`)
    - [x] Indian English (`en-IN`)
    - [x] Marathi (`mr-IN`)
    - [x] Tamil (`ta-IN`)
    - [x] Telugu (`te-IN`)
    - [x] Bengali (`bn-IN`)
    - [x] Gujarati (`gu-IN`)
    - [x] Kannada (`kn-IN`)
    - [x] Malayalam (`ml-IN`)
  - [x] Broadcast live subtitle events to all room members via Socket.io so everyone sees what is spoken.
  - [x] Accumulate captions log for post-meeting AI notes.

**Acceptance Verification:** Toggling captions produces real-time speech-to-text overlays across connected peers.

---

### Phase 4: Collaboration & Workspace Tools
- [x] **Milo Board (Collaborative Whiteboard):**
  - [x] Build `components/Whiteboard.jsx` with HTML5 2D canvas drawing.
  - [x] Sync pencil strokes in real time across peers via `whiteboard-draw` socket events.
  - [x] Include color palette (White, Google Blue, Red, Yellow, Green, Purple) and eraser.
  - [x] Export whiteboard drawing as PNG download (`Milo-Board-[roomId].png`).
- [x] **In-Call Real-Time Chat:**
  - [x] Build In-Call Chat drawer in `components/SidePanel.jsx`.
  - [x] Display sender name, host tag, time stamps, and unread notification badge on control bar.
- [x] **Floating Emoji Reactions:**
  - [x] Floating emoji picker tray in control bar (❤️, 👍, 👏, 😂, 😮, 😢, 🎉, 🔥).
  - [x] Floating bubble animation floating upwards on the screen for all participants.
  - [x] Full-screen confetti particle trigger for celebration emoji (`🎉`).

**Acceptance Verification:** Whiteboard strokes and emoji reactions appear instantly on peer screens with low latency.

---

### Phase 5: Security, Host Controls & Breakout Rooms
- [x] **Pre-Call Green Room (Lobby):**
  - [x] Build `components/LobbyModal.jsx` with webcam preview and mic check.
  - [x] Name input field (persisting user identity).
  - [x] Low Data mode pre-activation.
- [x] **Host Waiting Room & Entry Permissions:**
  - [x] Non-host participants enter waiting state (`Waiting for the host to let you in...`).
  - [x] Host receives alert in SidePanel with `[Admit]` and `[Deny]` action buttons.
  - [x] Denied participants receive polite notification with button to return home.
- [x] **Breakout Rooms:**
  - [x] Host control interface to generate 2, 3, or more breakout rooms.
  - [x] Socket broadcast of breakout room allocations.

**Acceptance Verification:** Guest user entering a host-controlled room is held in the waiting lobby until host admits them.

---

### Phase 6: Milo AI Meeting Assistant & Exports
- [x] Build API route `/api/summary` with Gemini 1.5 Flash SDK support.
- [x] Build smart fallback NLP engine that parses captured transcripts, speech contributions, questions, and action items.
- [x] Output bilingual executive summary (English + Hindi संक्षेप).
- [x] Build `components/AISummaryModal.jsx` with copy-to-clipboard and `.md` file download.
- [x] Trigger AI summary modal when leaving call or on-demand from SidePanel AI tab.

**Acceptance Verification:** Calling `/api/summary` generates a clean structured summary with action items and Hindi summary.

---

### Phase 7: End-to-End Browser Testing & Polish (Active)
- [x] Test Home Page UI (Clock, Hero, New Meeting, Join Input, Carousel).
- [x] Test Pre-Join Lobby screen in browser.
- [x] Test In-Call Video Grid, Control Bar buttons, and Side Panels.
- [ ] Run multi-tab automated 2-peer call simulation to verify WebRTC offer/answer exchange.
- [ ] Verify audio level meter animation under active mic input.
- [ ] Test mobile viewport responsive layout (< 768px).

---

### Phase 8: Mediasoup / LiveKit SFU Scaling (Future Horizon)
- [ ] Integrate Mediasoup or LiveKit SFU Docker container for webinar mode (>50 users).
- [ ] Implement simulcast video layers (1080p, 720p, 360p, 180p).
- [ ] Add recording service with WebM output.
