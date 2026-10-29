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

# 4. Automated E2E verification (server must be running; uses local Chrome with fake media devices)
node e2e-verify.mjs      # 21 checks: 2-peer WebRTC call, lobby, admit, chat, whiteboard sync, AI summary, backend
node e2e-signaling.mjs   # 16 checks: full Socket.io signaling protocol contract
node e2e-features.mjs    # 28 checks: settings, device pickers, dropdown geometry, whiteboard nib accuracy, mobile viewport
node e2e-ai-notes.mjs    # 6 checks: AI Notes panel, on-demand summary, post-call modal, exit-to-home

# Supabase transport (local stack via Docker, or hosted project env vars)
npx supabase start        # local Realtime + Postgres on http://127.0.0.1:54321
node e2e-supabase.mjs     # 21 checks: lobby, relay, snapshots, host handoff
```

**Optional Gemini summaries:** copy `.env.example` to `.env.local` and set `GEMINI_API_KEY=AIza...` (or paste a key into the AI Notes tab at runtime). Model defaults to `gemini-2.5-flash`; override with `GEMINI_MODEL`. Without a key the route returns a complete `smart-local` summary — AI Notes is fully usable with no setup. `.env*.local` is git-ignored.

Once started, the application is live at `http://localhost:3000`.

**Hosting (two supported paths):**
- **Vercel + Supabase (no server):** set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; the meeting page automatically uses `lib/signalingSupabase.js`. `server.js` is not needed on Vercel; Vercel runs `next build`. Free tier covers 200 concurrent Realtime connections, 2M messages/month, 100 msg/s, and 256 KB messages.
- **Single Node host (Render/Railway/Fly/VPS):** `npm start` runs `server.js` (Next.js + Socket.io). For a Vercel frontend with a separate signaling host, set `NEXT_PUBLIC_SIGNALING_URL` (ignored when Supabase is configured). See [README.md](README.md).

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
│   ├── icon.svg                     # Milo brand favicon (auto-served by App Router)
│   ├── page.jsx                     # Milo home page (New Meeting, Join Code, Feature Carousel)
│   ├── meet/[id]/page.jsx           # Core meeting room orchestrator & WebRTC connection hub
│   └── api/summary/route.js         # Gemini Flash API (configurable model) + smart NLP summary route
│
├── components/
│   ├── VideoGrid.jsx                # Responsive video grid, active speaker detection, pin, screen share
│   ├── ControlBar.jsx               # Floating bottom pill bar (Mic/Cam with device pickers, CC, Reactions, Board, Leave)
│   ├── DeviceMenu.jsx               # Chevron dropdown to switch microphone/camera (portal + viewport-clamped, enumerateDevices + hot-swap)
│   ├── SidePanel.jsx                # Multi-tab drawer (People with Host Admit/Deny, Chat, Breakouts, AI Notes)
│   ├── Whiteboard.jsx               # Milo Board: nib-accurate in-board pen, smooth midpoint-quadratic strokes, sync, PNG export
│   ├── LiveCaptions.jsx             # Real-time Web Speech recognition for Hindi, Tamil, Telugu, etc.
│   ├── LobbyModal.jsx               # Pre-meeting green room (device test, live mic meter, name, Low Data)
│   ├── SettingsModal.jsx            # Header-gear settings dialog (Audio / Video / General tabs, live test + preview)
│   └── AISummaryModal.jsx           # Post-meeting summary dialog with markdown export
│
├── lib/
│   ├── signaling.js                 # Transport factory: Supabase Realtime when configured, else Socket.io
│   ├── signalingSupabase.js         # Socket.io-compatible Realtime transport (lobby, presence, snapshots)
│   ├── supabaseClient.js            # Lazy singleton for @supabase/supabase-js (NEXT_PUBLIC_* env)
│   ├── webrtc.js                    # WebRTC Mesh manager, ICE candidate queue, STUN, track swap, speaker detector
│   └── settings.js                  # Persisted preferences (localStorage `milo.settings`) + Indian language list
│
├── e2e-verify.mjs                   # Puppeteer 2-peer call E2E (fake media devices) — 21 checks
├── e2e-signaling.mjs                # Raw Socket.io protocol contract test — 16 checks
├── e2e-features.mjs                 # Settings, in-call features + mobile viewport test — 28 checks
├── e2e-ai-notes.mjs                 # AI Notes generation + post-call summary modal — 6 checks
└── e2e-supabase.mjs                 # Supabase Realtime transport contract test — 21 checks
```

---

## 3. WebRTC & Media Lifecycle Rules for Agents

When editing or adding video/audio features, strictly observe these rules:

1. **`reactStrictMode: false`:** Kept false in `next.config.mjs` to prevent React 18 from unmounting and immediately remounting WebRTC `RTCPeerConnection` instances during development.
2. **Track Replacement over Renegotiation:** When switching from webcam to screen share, use `sender.replaceTrack(screenTrack)` instead of tearing down the peer connection. This ensures 0ms interruption for connected peers.
2b. **Device Switching:** Microphone/camera changes go through `WebRTCManager.replaceTrack(kind, track)` → `sender.replaceTrack()` on every peer. Never recreate the peer connection for a device swap; the page rebuilds `localStream` with the new track and syncs it to the manager.
3. **Low Data Throttling:** Never hard-kill the video track when entering Low Data mode. Use `sender.setParameters()` to cap the bitrate to 120 kbps and 15 fps so video stays fluid while saving bandwidth.
4. **Active Speaker Detection:** Use `createAudioSpeakerDetector` in `lib/webrtc.js` which connects an `AnalyserNode` to calculate RMS volume without routing local audio to speakers (preventing audio feedback loops).
5. **ICE Candidate Queue (never remove):** `lib/webrtc.js` buffers trickle ICE candidates that arrive before the peer's `setRemoteDescription` and flushes them after. Dropping them causes silent one-way media (verified in Phase 7 E2E). Offers arriving while we hold a local offer are handled with a rollback (glare).
6. **Late Media Attach:** `getUserMedia` may resolve after the user clicks Join. The meeting page pushes the stream into `WebRTCManager.setLocalStream()`, which attaches tracks and renegotiates automatically.
7. **Full Teardown:** Leaving must disconnect the socket and close all peer connections (handled by the unmount cleanup in `app/meet/[id]/page.jsx`) so the room receives `user-disconnected` immediately — no ghost tiles.
8. **Overlay Menus Use Portals:** Any dropdown that can appear inside a card with `overflow: hidden` (device pickers, future menus) must render through `createPortal` to `document.body` with clamped fixed positioning. Do not switch `DeviceMenu` back to an inline absolute dropdown — it gets clipped (verified bug).
9. **Preferences Go Through `lib/settings.js`:** Never read/write `localStorage` ad hoc. Use `loadSettings()` / `saveSettings()` so the settings dialog, green room, and meeting page stay in sync; new preference keys belong in `defaultSettings` too.
10. **Whiteboard Canvas Sizing & Cursor:** Stroke coordinates are CSS pixels mapped through `ctx.setTransform(buffer/CSS ratio)`. Never size the canvas buffer once at mount — a `ResizeObserver` keeps it in sync (DPR included). The pen/eraser must stay a DOM element positioned from the same coordinates (native `cursor: none`), otherwise the nib visually detaches from the ink at DPI scaling or after layout changes.
11. **AI Summary Transcript Contract:** Only finalized speech results are appended to `captionsLog` — interim fragments would flood the prompt and degrade summaries. `LiveCaptions` stores `onCaptionLogged` in a ref so parent re-renders never restart recognition (inline callbacks were causing transcript gaps). `/api/summary` must always return a usable `smart-local` summary when no key is configured; never fail just because `GEMINI_API_KEY` is absent.
12. **Never Drop a Renegotiation:** If `setLocalStream`/`replaceTrack` must add senders while `signalingState !== 'stable'`, queue the peer in `pendingNegotiations` and offer on the next `stable` transition. Dropping it yields intermittent one-way video (`readyState 0`, blank remote tile) verified in E2E. Keep one remote track per kind and call `video.play()` after attaching `srcObject`.
13. **Every Signaling Event Exists Twice:** The meeting page only knows Socket.io-style `on`/`emit`. A new event must be implemented in **both** `server.js` (Socket.io host) and `lib/signalingSupabase.js` (Realtime transport), or hosted-on-Vercel calls silently lose that feature. Keep Supabase broadcasts targeted with a `to` field, keep messages under 256 KB (chunk long payloads like whiteboard snapshots), and never remove a channel while an unflushed stroke batch is pending.

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
