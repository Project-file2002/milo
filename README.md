# Milo

Milo is a free, Google Meet-style video conferencing app built for Indian teams on high-speed or low-data connections. It includes HD/low-data WebRTC calling, host-admitted lobbies, chat, reactions, breakouts, live captions in nine Indian languages, a synchronized whiteboard with pen-accurate ink, device pickers, persisted preferences, and AI meeting notes.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The custom `server.js` serves the Next.js app and the Socket.io signaling server on the same port.

## Test

With the dev server running (Chrome installed, fake media devices):

```bash
npm install --no-save puppeteer-core
node e2e-verify.mjs      # 20 checks - 2-peer call, chat, whiteboard sync, summary
node e2e-signaling.mjs   # 16 checks - signaling protocol contract
node e2e-features.mjs    # 28 checks - settings, devices, whiteboard, mobile
node e2e-ai-notes.mjs    # 6 checks - AI Notes and post-call summary
```

## Configuration

Copy `.env.example` to `.env.local`.

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Optional. Enables Gemini-generated AI notes. Without it, the built-in `smart-local` engine runs. |
| `GEMINI_MODEL` | Optional. Defaults to `gemini-2.5-flash`. |
| `NEXT_PUBLIC_SIGNALING_URL` | URL of the external Socket.io server when the app is hosted on Vercel. Empty = same origin. |

## Deploying

**Vercel cannot host the Socket.io signaling server** — serverless functions cannot keep WebSockets open. Deploy in two parts:

1. **Signaling + media server:** deploy this repository to a Node host (Render, Railway, Fly.io, a VPS) as a web service.
   - Build: `npm install && npm run build`
   - Start: `npm start` (runs `server.js`, which serves Next.js and Socket.io)
2. **Frontend:** import the same repository into Vercel and set `NEXT_PUBLIC_SIGNALING_URL` to the Node host URL (for example `https://milo-signaling.onrender.com`). Redeploy after changing it.

For a single-host deployment, skip Vercel entirely and deploy the repository to Render/Railway; `server.js` serves the app and signaling on one URL.

TURN is not configured; WebRTC relies on public STUN servers, which is fine for most networks. Add a TURN server for strict corporate NATs.
