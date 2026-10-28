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
| **Phase 7** | Multi-Peer Automated E2E Verification & Browser Testing | ✅ Completed | 100% |
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
- [x] Build API route `/api/summary` with Gemini Flash support (`GEMINI_MODEL`, default `gemini-2.5-flash`).
- [x] Build smart fallback NLP engine that parses captured transcripts, speech contributions, questions, and action items.
- [x] Output bilingual executive summary (English + Hindi संक्षेप).
- [x] Build `components/AISummaryModal.jsx` with copy-to-clipboard and `.md` file download.
- [x] Trigger AI summary modal when leaving call or on-demand from SidePanel AI tab.

**Acceptance Verification:** Calling `/api/summary` generates a clean structured summary with action items and Hindi summary.

---

### Phase 7: End-to-End Browser Testing & Polish
- [x] Test Home Page UI (Clock, Hero, New Meeting, Join Input, Carousel).
- [x] Test Pre-Join Lobby screen in browser.
- [x] Test In-Call Video Grid, Control Bar buttons, and Side Panels.
- [x] Run multi-tab automated 2-peer call simulation to verify WebRTC offer/answer exchange.
- [x] Verify audio level meter animation under active mic input.
- [x] Test mobile viewport responsive layout (< 768px).

**Automated Verification Harness (added in Phase 7):**
- `e2e-verify.mjs` — 20 checks: Puppeteer drives two real Chrome instances (fake camera/mic devices) through host create ➜ guest lobby ➜ waiting-room admit ➜ bidirectional WebRTC video render ➜ chat ➜ reactions ➜ whiteboard pixel-level cross-peer sync ➜ AI summary ➜ clean leave/teardown.
- `e2e-signaling.mjs` — 16 checks: raw Socket.io clients verify every ARCHITECTURE.md protocol event (lobby admit/deny, late-joiner chat + whiteboard state replay, captions, hand raise, mute sync, breakout create/close, host reassignment on host leave).
- `e2e-features.mjs` — 28 checks: settings dialog (gear, camera preview, mic test meter, persistence, reset, close), lobby mic level meter, device dropdown clipping + Escape close, Low Data badge on/off, hand-raised tile indicator, captions bar with all Indian language options, breakout creation UI, reaction tray, mic + camera device pickers, pen/eraser custom cursors, nib-to-ink accuracy, smooth-stroke rendering, mobile 390px viewport (lobby, tile fit, control bar).
- `e2e-ai-notes.mjs` — 6 checks: AI Notes panel opens, on-demand summary generation (no API key required), action-items section, post-call summary modal on Leave, and closing the modal exits home instead of re-entering the call.
- Final run: **70/70 checks passed**; `npm run build` compiles clean.

**Bugs found & fixed during Phase 7 verification:**
- [x] **ICE candidate race (one-way media):** Trickle candidates arriving before `setRemoteDescription` were silently dropped, breaking the return media path. `lib/webrtc.js` now queues pending candidates per peer and flushes them once the remote description is applied; also handles offer glare via rollback.
- [x] **Late media stream never sent:** If `getUserMedia` resolved after "Join now", the peer connection kept zero senders. `WebRTCManager.setLocalStream()` now attaches tracks and auto-renegotiates; the meeting page syncs the stream into the manager.
- [x] **Ghost participants after leave:** Socket/RTC teardown was missing on unmount; leaving via the summary modal no longer notified the room. Added full disconnect/closeAll cleanup.
- [x] **Milo Board lost history:** Server-sent `whiteboardStrokes` on `room-joined` were discarded, so late joiners and re-opened boards rendered blank. Strokes are now kept in page state, replayed on open, and cleared on `whiteboard-clear`.
- [x] **Missing favicon:** Added `app/icon.svg` (removes the only 404).
- [x] **Lobby mic level meter (PRD §4.1):** Was specced but unimplemented; added a live AnalyserNode RMS volume meter beside the mic toggle in `LobbyModal.jsx`.
- [x] Added `data-participant-tile` attribute to video tiles for stable test selectors.

**UX polish after verification:**
- [x] **Real drawing cursors:** Milo Board shows a custom SVG pen cursor for the pen tool and a ring cursor for the eraser (hotspot at the pen tip) instead of the default crosshair/plus.
- [x] **Buttery-smooth strokes:** Drawing now uses Pointer Events with `getCoalescedEvents()` and midpoint-quadratic curves (`strokeId`-grouped segments), so local and remote canvases render identical smooth curves — no visible polyline joints.
- [x] **Device pickers (Google Meet-style chevrons):** Split mic and camera pills with a chevron menu in both the Green Room and the in-call ControlBar. Lists available `audioinput` / `videoinput` devices via `enumerateDevices()`, marks the active device, listens for `devicechange`, and hot-swaps tracks through `sender.replaceTrack()` (zero renegotiation, call never drops).
- [x] E2E coverage extended to 70 checks (pen/eraser cursors, nib-to-ink accuracy, smooth-stroke rendering, mic/camera pickers with live switch, settings dialog, dropdown geometry, AI Notes flow).
- [x] Device-picker checks hardened: the suite now ensures the chevron menu is open (reopening if a stray outside-click closed it) and polls on a 150 ms interval instead of animation frames, eliminating the intermittent `options=0` timing flake. Full suites pass 28/28, 20/20, 16/16, 6/6.
- [x] **AI Notes reliability fixed:** only finalized captions enter the transcript (interim fragments no longer flood the summary), `onCaptionLogged` is held in a ref so parent re-renders never restart speech recognition, and closing the post-call summary now exits to home instead of dropping the user back into the call they left.
- [x] **Intermittent one-way video fixed:** late `setLocalStream` during the join handshake used to skip renegotiation when `signalingState` was not `stable`, leaving a peer without the sender's video. Such peers are now queued in `pendingNegotiations` and offered on the next stable transition; remote streams keep one track per kind and tiles call `play()` explicitly. `e2e-verify` passed 20/20 on consecutive runs after the fix.
- [x] **Settings dialog implemented:** the header gear was a dead button. It now opens a Google Meet-style dialog — Audio (default mic/speaker + live mic test meter), Video (default camera + live preview), General (display name, Low Data default, captions language, reset). Preferences persist in `localStorage` (`lib/settings.js`) and pre-fill the green room, meeting name, devices, Low Data mode, and captions language.
- [x] **Device dropdown clipping fixed:** the list was clipped by the green-room video card's `overflow: hidden` and long labels ran off the edge. It now renders in a `document.body` portal, is clamped/flipped inside the viewport, and truncates labels with an ellipsis. Verified by an element-from-point visibility assertion.
- [x] E2E remote-video check now polls up to 20 s instead of sampling once at 8 s, removing the last WebRTC timing flake.
- [x] **Pen nib / ink alignment fixed:** the custom OS cursor image sat away from the real pointer (hotspot drift), and more importantly the canvas drawing buffer was sized once at mount (1196×604) while the board rendered larger (1246×634), so ink drifted from the pointer by up to ~50 px at the edges. The pen is now drawn in-board at the exact canvas coordinates (native cursor hidden) and the buffer follows the rendered size via `ResizeObserver` with an exact buffer/CSS transform. E2E asserts nib=(pointer) within 1.5 px and that a click deposits ink at the nib.

---

### Phase 8: Mediasoup / LiveKit SFU Scaling (Future Horizon)
- [ ] Integrate Mediasoup or LiveKit SFU Docker container for webinar mode (>50 users).
- [ ] Implement simulcast video layers (1080p, 720p, 360p, 180p).
- [ ] Add recording service with WebM output.
