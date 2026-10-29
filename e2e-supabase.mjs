// Protocol-level verification for the Supabase Realtime transport.
// Runs the real SupabaseSignaling client against a local or hosted Supabase
// Realtime endpoint (no browser needed), mirroring the Socket.io suite.
import { execSync } from 'node:child_process';

const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (name, ok, extra = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${extra ? ' | ' + extra : ''}`);
};

function localEnv() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };
  }
  try {
    const out = execSync('npx supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const read = (name) => out.match(new RegExp(`^${name}="?([^"\\n]+)"?`, 'm'))?.[1];
    return { url: read('API_URL'), key: read('ANON_KEY') };
  } catch {
    return {};
  }
}

async function waitFor(fn, timeout = 7000, step = 50) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (fn()) return true;
    await sleep(step);
  }
  return false;
}

const { SupabaseSignaling } = await import('./lib/signalingSupabase.js');
const { createClient } = await import('@supabase/supabase-js');

const env = localEnv();
if (!env.url || !env.key) {
  console.error('Supabase is not configured. Run `npx supabase start` or set NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  process.exit(1);
}
process.env.NEXT_PUBLIC_SUPABASE_URL = env.url;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.key;

const EVENTS = [
  'connect', 'room-joined', 'waiting-for-host', 'lobby-denied', 'user-connected',
  'signal', 'new-message', 'user-reaction', 'user-hand-toggled',
  'waiting-room-request', 'waiting-room-left', 'whiteboard-draw', 'whiteboard-clear',
  'user-disconnected', 'host-changed', 'breakout-rooms-updated',
  'breakout-rooms-closed', 'breakout-assigned', 'participant-media-changed',
  'new-caption',
];

function makeClient(roomId, userName, isHostIntent = false) {
  // One client (one WebSocket, one channel set) per simulated participant.
  const supabase = createClient(env.url, env.key, {
    realtime: { params: { eventsPerSecond: 30 } },
  });
  const client = new SupabaseSignaling({ roomId, userName, isHostIntent, supabase });
  const logEntries = [];
  let roomState = null;
  EVENTS.forEach((event) => {
    client.on(event, (payload) => {
      logEntries.push({ event, payload });
      if (event === 'room-joined') roomState = payload;
    });
  });
  const find = (event, predicate = () => true) => logEntries.find((x) => x.event === event && predicate(x.payload));
  const all = (event) => logEntries.filter((x) => x.event === event).map((x) => x.payload);
  return { client, find, all, roomState: () => roomState };
}

async function join(client, timer = 8000) {
  const connected = await waitFor(() => client.connectFired, timer);
  client.emit('join-room', { userName: client.userName, isHostIntent: client.isHostIntent });
  return connected;
}

async function main() {
  const room = `sb-verify-${Date.now().toString(36)}`;
  console.log(`Supabase endpoint: ${env.url} | room: ${room}`);

  const host = makeClient(room, 'HostA', true);
  const guest = makeClient(room, 'GuestB');

  log('Transport name is supabase', host.client.transportName === 'supabase');

  await join(host.client);
  await waitFor(() => host.roomState(), 8000);
  const hostJoined = host.roomState();
  log('Host receives room-joined with isHost=true', !!hostJoined && hostJoined.isHost === true);

  await join(guest.client);
  const sawWaiting = await waitFor(() => guest.find('waiting-for-host'), 8000);
  log('Guest held in lobby (waiting-for-host)', true === sawWaiting);

  const sawRequest = await waitFor(
    () => host.find('waiting-room-request', (p) => p.userName === 'GuestB'),
    8000,
  );
  log('Host receives waiting-room-request for GuestB', sawRequest);

  host.client.emit('host-lobby-decision', { targetPeerId: guest.client.id, approved: true });
  await waitFor(() => guest.roomState(), 8000);
  const guestJoined = guest.roomState();
  log(
    'Admitted guest receives room-joined with host listed',
    !!guestJoined && guestJoined.participants.some((p) => p.userName === 'HostA'),
  );
  log('Guest is not host', !!guestJoined && guestJoined.isHost === false);

  const sawUserConnected = await waitFor(
    () => host.find('user-connected', (p) => p.userName === 'GuestB'),
    6000,
  );
  log('Host sees guest join the room', sawUserConnected);

  guest.client.emit('signal', { to: host.client.id, signal: { type: 'offer', sdp: 'v=0-test' } });
  const gotSignal = await waitFor(
    () => host.find('signal', (p) => p.from === guest.client.id && p.signal?.sdp === 'v=0-test'),
    6000,
  );
  log('WebRTC offer relayed peer-to-peer via Realtime', gotSignal);

  host.client.emit('send-message', { text: 'hello from host', senderName: 'HostA' });
  const gotChat = await waitFor(
    () => guest.find('new-message', (p) => p.text === 'hello from host'),
    6000,
  );
  log('Chat relayed host -> guest', gotChat);

  const stroke = { strokeId: 's1', fromX: 0, fromY: 0, toX: 12, toY: 9, color: '#111', width: 2 };
  host.client.emit('whiteboard-draw', { stroke });
  const gotStroke = await waitFor(
    () => guest.find('whiteboard-draw', (p) => p.toX === 12),
    6000,
  );
  log('Whiteboard stroke relayed to peer (60ms batch)', gotStroke);

  guest.client.emit('toggle-hand', { raised: true, senderName: 'GuestB' });
  const gotHand = await waitFor(
    () => host.find('user-hand-toggled', (p) => p.peerId === guest.client.id && p.raised === true),
    6000,
  );
  log('Hand-raise relayed', gotHand);

  host.client.emit('send-reaction', { emoji: '🎉', senderName: 'HostA' });
  const gotReaction = await waitFor(
    () => guest.find('user-reaction', (p) => p.emoji === '🎉'),
    6000,
  );
  log('Reaction relayed to room', gotReaction);

  guest.client.emit('toggle-media', { type: 'video', enabled: false });
  const gotMedia = await waitFor(
    () => host.find('participant-media-changed', (p) => p.peerId === guest.client.id && p.enabled === false),
    6000,
  );
  log('Mute/video state synced to peers', gotMedia);

  host.client.emit('create-breakout-rooms', { count: 2 });
  const gotBreakouts = await waitFor(
    () => guest.find('breakout-rooms-updated', (p) => Array.isArray(p) && p.length === 2),
    6000,
  );
  log('Host creates 2 breakout rooms, guest notified', gotBreakouts);

  guest.client.emit('send-caption', { text: 'नमस्ते दोस्तों', lang: 'hi-IN' });
  const gotCaption = await waitFor(
    () => host.find('new-caption', (p) => p.lang === 'hi-IN'),
    6000,
  );
  log('Hindi caption relayed to peers', gotCaption);

  // Late joiner gets the persisted room state from the host snapshot.
  const late = makeClient(room, 'LateC');
  await join(late.client);
  const lateAsked = await waitFor(
    () => host.find('waiting-room-request', (p) => p.userName === 'LateC'),
    8000,
  );
  log('Late joiner passes through host lobby', lateAsked);
  host.client.emit('host-lobby-decision', { targetPeerId: late.client.id, approved: true });
  await waitFor(() => late.roomState(), 9000);
  const lateState = late.roomState();
  log(
    'Late joiner receives chat history snapshot',
    !!lateState && lateState.chatHistory.some((m) => m.text === 'hello from host'),
    lateState ? `messages=${lateState.chatHistory?.length || 0}` : 'no room-joined',
  );
  log(
    'Late joiner receives whiteboard history snapshot',
    !!lateState && lateState.whiteboardStrokes.length >= 1,
    lateState ? `strokes=${lateState.whiteboardStrokes?.length || 0}` : 'no room-joined',
  );

  // Denied guest never enters the call.
  const denied = makeClient(room, 'DeniedD');
  await join(denied.client);
  await waitFor(() => host.find('waiting-room-request', (p) => p.userName === 'DeniedD'), 8000);
  host.client.emit('host-lobby-decision', { targetPeerId: denied.client.id, approved: false });
  const deniedHit = await waitFor(() => denied.find('lobby-denied'), 6000);
  log('Denied guest receives lobby-denied', deniedHit);

  // Host leaves: role reassigned by presence, everyone else stays.
  const hostId = host.client.id;
  host.client.disconnect();
  const hostChanged = await waitFor(
    () => guest.find('host-changed', (p) => p.newHostId === guest.client.id),
    9000,
  );
  log('Host role reassigned when host leaves', hostChanged);
  const hostGone = await waitFor(
    () => guest.find('user-disconnected', (p) => p.peerId === hostId),
    6000,
  );
  log('Departing host removed from room presence', hostGone);

  guest.client.disconnect();
  late.client.disconnect();
  denied.client.disconnect();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== SUPABASE RESULT: ${results.length - failed.length}/${results.length} passed ===`);
  if (failed.length) console.log(failed.map((f) => f.name).join('\n'));
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error('Supabase suite crashed:', err);
  process.exit(1);
});
