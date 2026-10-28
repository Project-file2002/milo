# 🤖 Milo — AI Agent & Developer Workflow Guide

Welcome to the **Milo** codebase. This guide is specifically prepared so that any AI agent (Antigravity, Gemini CLI, Claude Code, Cursor) or human engineer can instantly understand the architecture, run local instances, debug media streams, and extend features without unnecessary token churn.

---

## 1. Quick Start Commands

```bash
# 1. Install dependencies (Node v20+ or v24+ required)
npm install

# 2. Run Milo unified dev server (Next.js + Socket.io signaling on port 3000)
npm run dev

# 3. Build for production
npm run build
npm start
```

Once started, the application is live at `http://localhost:3000`.

---

## 2. Project Layout & File Map

```
e:\Projects\milo\
├── PRD.md                           # Master Product Requirements Document
├── ARCHITECTURE.md                  # System architecture, signaling specs & diagrams
├── ROADMAP_PHASES.md                # Phase-wise roadmap & active progress tracker
├── REPOSITORIES_AND_REFERENCES.md   # Curated GitHub repositories, tools & reverse engineering
├── AGENT_GUIDE.md                   # This developer & agent workflow guide
├── milo_features.txt                # Initial feature summary notes
│
├── server.js                        # Custom Node HTTP server + Socket.io WebRTC signaling
├── next.config.mjs                  # Next.js configuration (reactStrictMode: false for WebRTC)
├── package.json                     # Project scripts and dependencies
│
├── app/
│   ├── globals.css                  # Google Meet Material 3 Dark theme, animations, grid classes
│   ├── layout.jsx                   # Root layout, fonts, and Indian regional SEO metadata
│   ├── page.jsx                     # Milo home page (New Meeting, Join Code, Feature Carousel)
│   ├── meet/[id]/page.jsx           # Core meeting room orchestrator & WebRTC connection hub
│   └── api/summary/route.js         # Gemini 1.5 Flash API + smart NLP meeting summary route
│
├── components/
│   ├── VideoGrid.jsx                # Responsive video grid, active speaker detection, pin, screen share
│   ├── ControlBar.jsx               # Floating bottom pill bar (Mic, Cam, CC, Reactions, Whiteboard, Leave)
│   ├── SidePanel.jsx                # Multi-tab drawer (People with Host Admit/Deny, Chat, Breakouts, AI Notes)
│   ├── Whiteboard.jsx               # Collaborative Milo Board with real-time sync & PNG export
│   ├── LiveCaptions.jsx             # Real-time Web Speech recognition for Hindi, Tamil, Telugu, etc.
│   ├── LobbyModal.jsx               # Pre-meeting green room (device test, name input, Low Data switch)
│   └── AISummaryModal.jsx           # Post-meeting summary dialog with markdown export
│
└── lib/
    └── webrtc.js                    # WebRTC Mesh manager, STUN servers, track replacement, audio speaker detector
```

---

## 3. WebRTC & Media Lifecycle Rules for Agents

When editing or adding video/audio features, strictly observe these rules:

1. **`reactStrictMode: false`:** Kept false in `next.config.mjs` to prevent React 18 from unmounting and immediately remounting WebRTC `RTCPeerConnection` instances during development.
2. **Track Replacement over Renegotiation:** When switching from webcam to screen share, use `sender.replaceTrack(screenTrack)` instead of tearing down the peer connection. This ensures 0ms interruption for connected peers.
3. **Low Data Throttling:** Never hard-kill the video track when entering Low Data mode. Use `sender.setParameters()` to cap the bitrate to 120 kbps and 15 fps so video stays fluid while saving bandwidth.
4. **Active Speaker Detection:** Use `createAudioSpeakerDetector` in `lib/webrtc.js` which connects an `AnalyserNode` to calculate RMS volume without routing local audio to speakers (preventing audio feedback loops).

---

## 4. Multi-Peer Testing Instructions (In Browser)

To test multi-party calling on your machine:
1. Open `http://localhost:3000` in Tab 1 (Host).
2. Click **New meeting** ➔ **Start an instant meeting**. Enter name "Host Abhishek" and click **Join now**.
3. Copy the meeting URL (or room code, e.g. `http://localhost:3000/meet/abc-defg-hij`).
4. Open an Incognito Window or Tab 2 with the copied URL.
5. In Tab 2, enter name "Guest Priya", and click **Join now**.
6. Tab 1 receives a notification in the SidePanel: `Priya wants to join this call`. Click **Admit**.
7. Both tabs now establish direct P2P video/audio streams in the responsive grid.

---

## 5. Token Efficiency & Agent Best Practices

- Always read `ROADMAP_PHASES.md` first before starting any new phase.
- Mark completed items with `[x]` upon verifying in browser.
- Use `browser_subagent` with concise, targeted prompts when visual verification is required.
