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
node e2e-verify.mjs      # 21 checks - 2-peer call, chat, whiteboard sync, summary, backend
node e2e-signaling.mjs   # 16 checks - Socket.io signaling protocol contract
node e2e-features.mjs    # 28 checks - settings, devices, whiteboard, mobile
node e2e-ai-notes.mjs    # 6 checks - AI Notes and post-call summary
```

Supabase transport (needs the local stack, or a hosted project via env vars):

```bash
npx supabase start        # Docker required
node e2e-supabase.mjs     # 21 checks - lobby, relay, snapshots, host handoff
```

The browser suites also run against Supabase: put the two `NEXT_PUBLIC_SUPABASE_*` values in `.env.local`, restart `npm run dev`, and rerun them. `window.__MILO_SIGNALING__` reports `supabase` or `socketio` so a suite can assert the active backend.

## Configuration

Copy `.env.example` to `.env.local`.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. When set together with the anon key, meetings use Supabase Realtime instead of Socket.io. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key. Safe to expose; row-level security and channel privacy are the controls. |
| `NEXT_PUBLIC_SIGNALING_URL` | URL of an external Socket.io server. Empty = same origin (`server.js`). Ignored when Supabase is configured. |
| `GEMINI_API_KEY` | Optional. Enables Gemini-generated AI notes. Without it, the built-in `smart-local` engine runs. |
| `GEMINI_MODEL` | Optional. Defaults to `gemini-2.5-flash`. |

## Deploying

### Option A — Vercel + Supabase (no server to run)

1. Create a free project at [supabase.com](https://supabase.com). No tables or SQL are needed: Milo only uses Realtime Broadcast + Presence.
2. In Supabase, open **Project Settings > API** and copy the **Project URL** and **anon/public key**.
3. Import this repository into Vercel and add both values as environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. Deploy. Vercel builds with `next build`; `server.js` is not used, and signaling runs through Supabase.

Free-tier limits that matter: 200 concurrent Realtime connections, 2,000,000 messages/month, 100 messages/second, 256 KB per message, 100 channels per connection. Milo uses two channels per participant (lobby + room) and batches whiteboard strokes, so a small team (roughly 20-40 people in calls at once) fits comfortably.

Channels are public and named after the room code (`milo-room-<code>`). Anyone with the project anon key who knows the code could subscribe, so treat room links as the secret; for sensitive deployments add Supabase Auth and private channels.

### Option B — single Node host (Render, Railway, Fly.io, VPS)

Deploy this repository as a web service:

- Build: `npm install && npm run build`
- Start: `npm start` (runs `server.js`, which serves Next.js and Socket.io on one URL)

### Option C — split frontend and signaling

Host `server.js` on a Node host, then deploy the frontend to Vercel with `NEXT_PUBLIC_SIGNALING_URL` pointing at it (for example `https://milo-signaling.onrender.com`). Redeploy after changing the variable.

TURN is not configured; WebRTC relies on public STUN servers, which is fine for most networks. Add a TURN server for strict corporate NATs.
