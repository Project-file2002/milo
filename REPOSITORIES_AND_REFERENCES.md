# 📚 Milo — Curated Repositories, References & Agent Tooling

This document serves as the master technical directory for any AI agent or software engineer working on **Milo**. It catalogues the foundational open-source repositories, reverse engineering toolchains, WebRTC protocols, and AI SDKs.

---

## 1. Reverse Engineering & Agentic Inspection

| Repository | URL | Purpose & Utility for Milo |
| :--- | :--- | :--- |
| **morluto/rea** | [https://github.com/morluto/rea](https://github.com/morluto/rea) | **Reverse Engineer Anything with Agents.** Inspect web, Electron, and native application runtime behaviors, trace media pipelines, and analyze protocol contracts. |
| **skills.sh / REA Skill** | [https://skills.sh/morluto/rea/reverse-engineer-anything](https://skills.sh/morluto/rea/reverse-engineer-anything) | Pre-packaged MCP workflow instructions for automated reverse engineering and evidence collection. |
| **Google Meet Web App** | [https://meet.google.com](https://meet.google.com) | Direct target reference for UX, layout, floating pill control bar, speaker layouts, and keyboard shortcut behaviors. |

---

## 2. WebRTC, Media Streaming & Signaling Repositories

| Repository | URL | Key Patterns / Inspiration |
| :--- | :--- | :--- |
| **jitsi/jitsi-meet** | [https://github.com/jitsi/jitsi-meet](https://github.com/jitsi/jitsi-meet) | Open-source enterprise video meetings: lobby waiting rooms, device selection, bandwidth estimation, and participant role management. |
| **livekit/livekit** | [https://github.com/livekit/livekit](https://github.com/livekit/livekit) | Modern Go-based SFU WebRTC server with WebAudio visualizer, dynamic bitrate scaling, and track subscription model. |
| **versatica/mediasoup** | [https://github.com/versatica/mediasoup](https://github.com/versatica/mediasoup) | Ultra-fast Node.js C++ WebRTC SFU for handling 100+ streams in large webinars and lectures. |
| **socketio/socket.io** | [https://github.com/socketio/socket.io](https://github.com/socketio/socket.io) | Real-time bi-directional event signaling over WebSocket with fallback polling. Powering Milo's signaling server (`server.js`). |
| **peers/peerjs** | [https://github.com/peers/peerjs](https://github.com/peers/peerjs) | Clean browser-side abstraction for WebRTC ICE candidate negotiation, SDP offer/answer exchanges, and data channels. |
| **feross/simple-peer** | [https://github.com/feross/simple-peer](https://github.com/feross/simple-peer) | Lightweight node-style EventEmitter for WebRTC peer connections. |

---

## 3. Real-Time Collaboration & Whiteboard Repositories

| Repository | URL | Key Patterns / Inspiration |
| :--- | :--- | :--- |
| **excalidraw/excalidraw** | [https://github.com/excalidraw/excalidraw](https://github.com/excalidraw/excalidraw) | Virtual collaborative whiteboard with hand-drawn aesthetic, shape math, and peer sync algorithms. |
| **tldraw/tldraw** | [https://github.com/tldraw/tldraw](https://github.com/tldraw/tldraw) | High-performance infinite 2D canvas library in React, vector math, and stroke serialization. |
| **catdad/canvas-confetti** | [https://github.com/catdad/canvas-confetti](https://github.com/catdad/canvas-confetti) | Performant in-browser particle celebration animations for emoji reaction events (`🎉`). |

---

## 4. AI Transcription, Speech Recognition & LLM SDKs

| Repository / API | URL | Purpose in Milo |
| :--- | :--- | :--- |
| **Google Gemini API** | [https://github.com/google-gemini/generative-ai-js](https://github.com/google-gemini/generative-ai-js) | Generates executive summaries, Hindi/regional translations, and structured action items from live transcripts via Gemini Flash (`GEMINI_MODEL`, default `gemini-2.5-flash`). |
| **Web Speech API** | [MDN Web Speech API Reference](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) | Zero-cost, zero-latency browser native speech recognition supporting Indian languages (`hi-IN`, `ta-IN`, `te-IN`, `mr-IN`, `en-IN`). |
| **openai/whisper** | [https://github.com/openai/whisper](https://github.com/openai/whisper) | Reference robust multilingual speech recognition model for server-side audio transcription fallback. |

---

## 5. Design Systems & UI Icons

| Project | URL | Usage in Milo |
| :--- | :--- | :--- |
| **Google Material 3** | [https://m3.material.io/](https://m3.material.io/) | Color palettes, surface dark theme elevations (`#202124`, `#303134`, `#3c4043`), rounded pill geometries, and typography tokens. |
| **lucide-icons/lucide** | [https://github.com/lucide-icons/lucide](https://github.com/lucide-icons/lucide) | Modern SVG iconography for all in-call meeting controls (`Mic`, `Video`, `Subtitles`, `Sparkles`, `Hand`, `PenTool`, etc.). |
| **Google Fonts** | [Google Sans & Inter](https://fonts.google.com/) | Crisp, legible typography across video overlays, chat messages, and live captions. |

---

## 6. How Agents Should Utilize These References

1. **For Feature Reverse-Engineering:** When inspecting Google Meet or other conferencing apps, consult [morluto/rea](https://github.com/morluto/rea) patterns or utilize the Antigravity browser tools to inspect layout metrics, accessibility roles, and event sequences.
2. **For Media Pipeline Debugging:** If WebRTC handshake issues occur, reference [simple-peer](https://github.com/feross/simple-peer) or [peerjs](https://github.com/peers/peerjs) connection life-cycle state machines.
3. **For High-Scale SFU Migration (Phase 5):** When transitioning beyond mesh P2P (for 100+ participants), inspect [mediasoup](https://github.com/versatica/mediasoup) or [livekit](https://github.com/livekit/livekit) media routers.
