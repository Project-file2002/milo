import { io } from 'socket.io-client';

const URL = 'http://localhost:3000';
const results = [];
const log = (name, ok, extra = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${extra ? ' | ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function once(socket, event, timeout = 3000) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve({ found: false }), timeout);
    socket.once(event, (payload) => { clearTimeout(t); resolve({ found: true, payload }); });
  });
}

const room = 'sig-test-' + Date.now();
const a = io(URL, { transports: ['websocket'] });
await once(a, 'connect');
const b = io(URL, { transports: ['websocket'] });
await once(b, 'connect');

// A joins as host
const aJoinP = once(a, 'room-joined');
a.emit('join-room', { roomId: room, userName: 'HostA', isHostIntent: true });
const aState = (await aJoinP).payload;
log('Host receives room-joined with isHost=true', !!aState && aState.isHost === true);

// B joins as guest -> waiting room
const bWaitingP = once(b, 'waiting-for-host');
const bReqP = once(a, 'waiting-room-request');
b.emit('join-room', { roomId: room, userName: 'GuestB' });
const bWaiting = await bWaitingP;
const bReq = await bReqP;
log('Guest held in lobby (waiting-for-host)', bWaiting.found);
log('Host receives waiting-room-request for GuestB', bReq.found && bReq.payload.userName === 'GuestB');

const bJoinP = once(b, 'room-joined');
a.emit('host-lobby-decision', { roomId: room, targetPeerId: bReq.payload.peerId, approved: true });
const bState = (await bJoinP).payload;
log('Admitted guest receives room-joined with host listed', !!bState && bState.participants.some((p) => p.userName === 'HostA'));

// Whiteboard relay + persistence for late joiner
let bGotStroke = null;
b.on('whiteboard-draw', (s) => { bGotStroke = s; });
a.emit('whiteboard-draw', { roomId: room, stroke: { fromX: 1, fromY: 2, toX: 3, toY: 4, color: '#fff', width: 2, tool: 'pen' } });
await sleep(400);
log('Whiteboard stroke relayed to peer', !!bGotStroke && bGotStroke.toX === 3);

const c = io(URL, { transports: ['websocket'] });
await once(c, 'connect');
const cJoinP = once(c, 'room-joined');
const cReqP = once(a, 'waiting-room-request');
c.emit('join-room', { roomId: room, userName: 'GuestC' });
const cReq = await cReqP;
a.emit('host-lobby-decision', { roomId: room, targetPeerId: cReq.payload.peerId, approved: true });
const cState = (await cJoinP).payload;
log('Late joiner receives persisted whiteboard strokes', !!cState && cState.whiteboardStrokes.length >= 1, cState ? 'strokes=' + cState.whiteboardStrokes.length : 'no room-joined');

// Deny flow
const e = io(URL, { transports: ['websocket'] });
await once(e, 'connect');
const eDeniedP = once(e, 'lobby-denied');
const eReqP = once(a, 'waiting-room-request');
e.emit('join-room', { roomId: room, userName: 'GuestE' });
const eReq = await eReqP;
a.emit('host-lobby-decision', { roomId: room, targetPeerId: eReq.payload.peerId, approved: false });
const eDenied = await eDeniedP;
log('Denied guest receives lobby-denied', eDenied.found);

// Captions relay
let bCaption = null;
b.on('new-caption', (cap) => { bCaption = cap; });
a.emit('send-caption', { roomId: room, text: 'नमस्ते सबको', lang: 'hi-IN', senderName: 'HostA' });
await sleep(400);
log('Hindi caption relayed to peers', !!bCaption && bCaption.lang === 'hi-IN');

// Hand raise relay
let bHand = null;
b.on('user-hand-toggled', (h) => { bHand = h; });
a.emit('toggle-hand', { roomId: room, raised: true, senderName: 'HostA' });
await sleep(400);
log('Hand-raise relayed', !!bHand && bHand.raised === true);

// Media toggle relay
let bMedia = null;
b.on('participant-media-changed', (m) => { bMedia = m; });
a.emit('toggle-media', { roomId: room, type: 'audio', enabled: false });
await sleep(400);
log('Mute state synced to peers', !!bMedia && bMedia.enabled === false);

// Breakout rooms
let bBreak = null;
b.on('breakout-rooms-updated', (r) => { bBreak = r; });
a.emit('create-breakout-rooms', { roomId: room, count: 3 });
await sleep(400);
log('Host creates 3 breakout rooms, all peers notified', !!bBreak && bBreak.length === 3);
let bClosed = false;
b.on('breakout-rooms-closed', () => { bClosed = true; });
a.emit('close-breakout-rooms', { roomId: room });
await sleep(400);
log('Breakout rooms closed broadcast', bClosed);

// Chat history for late joiner
a.emit('send-message', { roomId: room, text: 'persisted msg', senderName: 'HostA' });
await sleep(300);
const d = io(URL, { transports: ['websocket'] });
await once(d, 'connect');
const dJoinP = once(d, 'room-joined');
const dReqP = once(a, 'waiting-room-request');
d.emit('join-room', { roomId: room, userName: 'GuestD' });
const dReq = await dReqP;
a.emit('host-lobby-decision', { roomId: room, targetPeerId: dReq.payload.peerId, approved: true });
const dState = (await dJoinP).payload;
log('Late joiner receives chat history', !!dState && dState.chatHistory.some((m) => m.text === 'persisted msg'));

// Reactions relay
let bReaction = null;
b.on('user-reaction', (r) => { bReaction = r; });
a.emit('send-reaction', { roomId: room, emoji: '🎉', senderName: 'HostA' });
await sleep(400);
log('Reaction relayed to room', !!bReaction && bReaction.emoji === '🎉');

// Host reassignment on host leave
let bHostChanged = null;
b.on('host-changed', (p) => { bHostChanged = p; });
let bUserLeft = null;
b.on('user-disconnected', (p) => { bUserLeft = p; });
a.disconnect();
await sleep(800);
log('Departing host broadcast as user-disconnected', !!bUserLeft);
log('Host role reassigned when host leaves', !!bHostChanged);

b.disconnect(); c.disconnect(); d.disconnect(); e.disconnect();
const failed = results.filter((r) => !r.ok);
console.log(`\n=== SIGNALING RESULT: ${results.length - failed.length}/${results.length} passed ===`);
process.exit(failed.length ? 1 : 0);
