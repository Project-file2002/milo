'use client';

import { getSupabaseClient } from './supabaseClient.js';

// Supabase Realtime replaces the Socket.io server when NEXT_PUBLIC_SUPABASE_URL
// and NEXT_PUBLIC_SUPABASE_ANON_KEY are set. It exposes the same on()/emit()
// surface, so the meeting page stays transport-agnostic.
//
// Two public broadcast channels per room:
//   milo-lobby-<room>  every client; carries admission + the full participant registry
//   milo-room-<room>   admitted clients only; carries WebRTC + in-call events
// Room history (chat/whiteboard/breakouts) is kept in each client's adapter and
// snapshotted from the host when a late participant joins, matching the old
// in-memory Socket.io semantics.

const LOBBY_PREFIX = 'milo-lobby-';
const ROOM_PREFIX = 'milo-room-';
const LOBBY_SETTLE_MS = 900;
const HOST_GRACE_MS = 900;
const PARTNER_WAIT_MS = 3000;
const SNAPSHOT_TIMEOUT_MS = 2500;
const SNAPSHOT_CHUNK_STROKES = 300;
const STROKE_FLUSH_MS = 60;
const MAX_CHAT_HISTORY = 200;
const MAX_STROKES = 20000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `peer-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function presenceList(channel) {
  if (!channel) return [];
  const state = channel.presenceState?.() || {};
  return Object.values(state)
    .flat()
    .filter((entry) => entry && entry.peerId);
}

export class SupabaseSignaling {
  constructor({ roomId, userName, isHostIntent = false, supabase = null }) {
    this.transportName = 'supabase';
    // supabase-js reuses a channel instance per topic within one client, so
    // callers that need independent rooms (tests, multi-instance tooling) can
    // pass a dedicated client. The browser uses the shared singleton.
    this.supabase = supabase || getSupabaseClient();
    if (!this.supabase) {
      throw new Error('Supabase signaling requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }

    this.roomId = roomId;
    this.userName = (userName || '').trim() || 'Participant';
    this.isHostIntent = !!isHostIntent;
    this.id = makeId();
    this.joinedAt = Date.now();

    this.handlers = new Map();
    this.admitted = false;
    this.roomJoined = false;
    this.enteringRoom = false;
    this.disconnected = false;
    this.joinRequested = false;
    this.connectFired = false;

    this.hostId = null;
    this.lobbySynced = false;
    this.lobbySubscribed = false;
    this.roomSubscribed = false;
    this.lobbyPresences = new Map();
    this.knownWaiting = new Set();
    this.knownPeers = new Set();
    this.waitingNotified = false;
    this.denied = false;
    this.firstEmptySyncAt = null;

    this.participants = new Map();
    this.media = { audio: true, video: true, handRaised: false };
    this.chatHistory = [];
    this.strokes = [];
    this.breakoutRooms = [];

    this.strokeQueue = [];
    this.strokeTimer = null;
    this.snapshotBuffer = null;
    this.reconcileTimer = null;
    this.lobbyTimer = null;

    this.lobby = null;
    this.room = null;

    this.setupLobby();
  }

  on(event, handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(handler);
    return this;
  }

  off(event, handler) {
    if (!handler) this.handlers.delete(event);
    else this.handlers.get(event)?.delete(handler);
    return this;
  }

  emitLocal(event, payload) {
    const handlers = this.handlers.get(event);
    if (!handlers) return;
    handlers.forEach((handler) => {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[supabase-signaling] handler for "${event}" failed:`, err);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Lobby channel
  // ---------------------------------------------------------------------------

  setupLobby() {
    const lobby = this.supabase.channel(`${LOBBY_PREFIX}${this.roomId}`, {
      config: {
        presence: { key: this.id },
        broadcast: { self: false },
      },
    });
    this.lobby = lobby;

    const onPresence = () => this.handleLobbyPresence();
    lobby.on('presence', { event: 'sync' }, onPresence);
    lobby.on('presence', { event: 'join' }, onPresence);
    lobby.on('presence', { event: 'leave' }, onPresence);

    lobby.on('broadcast', { event: 'lobby-decision' }, ({ payload }) => {
      if (!payload || payload.to !== this.id) return;
      if (payload.approved) {
        this.admitSelf();
      } else {
        // Drop our presence so the host's waiting list does not keep showing us.
        this.denied = true;
        this.lobby?.untrack?.();
        this.emitLocal('lobby-denied', {
          reason: 'The host has denied admission to this meeting.',
        });
      }
    });

    lobby.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.lobbySubscribed = true;
        if (this.joinRequested) this.trackLobby();
        if (!this.connectFired) {
          this.connectFired = true;
          this.emitLocal('connect');
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn(`[supabase-signaling] lobby channel ${status.toLowerCase()}`);
      }
    });
  }

  joinRoom({ userName, isHostIntent } = {}) {
    if (this.joinRequested || this.disconnected) return;
    this.joinRequested = true;
    if (userName && userName.trim()) this.userName = userName.trim();
    if (isHostIntent) this.isHostIntent = true;

    if (this.isHostIntent) {
      // Creating a meeting is admitted immediately; no host to ask.
      this.admitSelf();
      return;
    }

    this.trackLobby();
    // Wait for the first presence sync so we can tell whether a host exists.
    this.lobbyTimer = setTimeout(() => this.maybeJoinFromLobby(), LOBBY_SETTLE_MS);
  }

  maybeJoinFromLobby() {
    if (this.admitted || this.disconnected || this.denied || !this.joinRequested) return;
    if (!this.lobbySynced) {
      this.lobbyTimer = setTimeout(() => this.maybeJoinFromLobby(), LOBBY_SETTLE_MS);
      return;
    }

    const admittedParticipants = [...this.lobbyPresences.values()].filter(
      (p) => p.admitted && p.peerId && p.peerId !== this.id,
    );

    if (admittedParticipants.length === 0) {
      // First person in the room becomes host, matching server.js — but only
      // after a grace period so a host that is still subscribing to the lobby
      // is not upstaged by a guest who arrived a moment earlier.
      if (!this.firstEmptySyncAt) this.firstEmptySyncAt = Date.now();
      if (Date.now() - this.firstEmptySyncAt < HOST_GRACE_MS) {
        this.lobbyTimer = setTimeout(() => this.maybeJoinFromLobby(), 300);
        return;
      }
      this.admitSelf();
      return;
    }

    this.firstEmptySyncAt = null;

    if (!this.waitingNotified) {
      this.waitingNotified = true;
      this.emitLocal('waiting-for-host');
    }
  }

  handleLobbyPresence() {
    this.lobbySynced = true;
    const next = new Map();
    presenceList(this.lobby).forEach((entry) => next.set(entry.peerId, entry));
    this.lobbyPresences = next;

    if (this.joinRequested && !this.admitted) this.maybeJoinFromLobby();
    if (!this.admitted) return;

    this.recomputeHost();
    if (this.hostId === this.id) this.syncWaitingList();
  }

  recomputeHost() {
    const admitted = [...this.lobbyPresences.values()].filter((p) => p.admitted && p.peerId);
    if (!admitted.length) {
      if (!this.hostId) this.setHost(this.id);
      return;
    }

    admitted.sort(
      (a, b) =>
        Number(!!b.isHostIntent) - Number(!!a.isHostIntent) ||
        (Number(a.joinedAt) || 0) - (Number(b.joinedAt) || 0) ||
        String(a.peerId).localeCompare(String(b.peerId)),
    );

    const nextHostId = admitted[0].peerId;
    if (nextHostId !== this.hostId) this.setHost(nextHostId);
  }

  setHost(hostId) {
    this.hostId = hostId;
    this.emitLocal('host-changed', { newHostId: hostId });
    this.trackLobby();
    this.trackRoom();
  }

  syncWaitingList() {
    const waiting = new Map();
    this.lobbyPresences.forEach((entry, peerId) => {
      if (!entry.admitted && peerId !== this.id) waiting.set(peerId, entry);
    });

    waiting.forEach((entry, peerId) => {
      if (this.knownWaiting.has(peerId)) return;
      this.emitLocal('waiting-room-request', {
        peerId,
        userName: entry.userName || 'Guest Participant',
        userAvatar: entry.userAvatar || '',
      });
    });

    this.knownWaiting.forEach((peerId) => {
      if (!waiting.has(peerId)) this.emitLocal('waiting-room-left', { peerId });
    });

    this.knownWaiting = new Set(waiting.keys());
  }

  admitSelf() {
    if (this.admitted || this.disconnected) return;
    this.admitted = true;
    this.recomputeHost();
    this.trackLobby();
    this.setupRoom();
  }

  trackLobby() {
    if (!this.lobby || !this.lobbySubscribed || this.disconnected) return;
    this.lobby
      .track({
        peerId: this.id,
        userName: this.userName,
        userAvatar: '',
        isHostIntent: this.isHostIntent,
        admitted: this.admitted,
        isHost: this.hostId === this.id,
        joinedAt: this.joinedAt,
      })
      .catch((err) => console.warn('[supabase-signaling] lobby track failed:', err));
  }

  // ---------------------------------------------------------------------------
  // Room channel
  // ---------------------------------------------------------------------------

  setupRoom() {
    if (this.room || this.enteringRoom || this.disconnected) return;
    this.enteringRoom = true;

    const room = this.supabase.channel(`${ROOM_PREFIX}${this.roomId}`, {
      config: {
        presence: { key: this.id },
        broadcast: { self: false },
      },
    });
    this.room = room;

    const onPresence = () => this.scheduleReconcile();
    room.on('presence', { event: 'sync' }, onPresence);
    room.on('presence', { event: 'join' }, onPresence);
    room.on('presence', { event: 'leave' }, onPresence);

    room.on('broadcast', { event: 'signal' }, ({ payload }) => {
      if (!payload || payload.to !== this.id) return;
      this.emitLocal('signal', { from: payload.from, signal: payload.signal, meta: payload.meta });
    });

    room.on('broadcast', { event: 'media' }, ({ payload }) => {
      if (!payload || !payload.peerId || payload.peerId === this.id) return;
      const participant = this.participants.get(payload.peerId);
      if (participant && (payload.type === 'audio' || payload.type === 'video')) {
        participant[payload.type] = payload.enabled;
      }
      this.emitLocal('participant-media-changed', {
        peerId: payload.peerId,
        type: payload.type,
        enabled: payload.enabled,
      });
    });

    room.on('broadcast', { event: 'hand' }, ({ payload }) => {
      if (!payload || !payload.peerId || payload.peerId === this.id) return;
      const participant = this.participants.get(payload.peerId);
      if (participant) participant.handRaised = !!payload.raised;
      this.emitLocal('user-hand-toggled', {
        peerId: payload.peerId,
        senderName: payload.senderName,
        raised: !!payload.raised,
      });
    });

    room.on('broadcast', { event: 'message' }, ({ payload }) => {
      const message = payload?.message;
      if (!message || !message.id) return;
      if (this.chatHistory.some((m) => m.id === message.id)) return;
      this.chatHistory.push(message);
      if (this.chatHistory.length > MAX_CHAT_HISTORY) this.chatHistory.shift();
      this.emitLocal('new-message', message);
    });

    room.on('broadcast', { event: 'reaction' }, ({ payload }) => {
      if (!payload || payload.peerId === this.id) return;
      this.emitLocal('user-reaction', payload);
    });

    room.on('broadcast', { event: 'whiteboard-strokes' }, ({ payload }) => {
      const strokes = payload?.strokes;
      if (!Array.isArray(strokes)) return;
      strokes.forEach((stroke) => {
        this.strokes.push(stroke);
        this.emitLocal('whiteboard-draw', stroke);
      });
      if (this.strokes.length > MAX_STROKES) {
        this.strokes = this.strokes.slice(-MAX_STROKES);
      }
    });

    room.on('broadcast', { event: 'whiteboard-clear' }, () => {
      this.strokes = [];
      this.emitLocal('whiteboard-clear');
    });

    room.on('broadcast', { event: 'breakout-updated' }, ({ payload }) => {
      this.breakoutRooms = Array.isArray(payload?.rooms) ? payload.rooms : [];
      this.emitLocal('breakout-rooms-updated', this.breakoutRooms);
    });

    room.on('broadcast', { event: 'breakout-closed' }, () => {
      this.breakoutRooms = [];
      this.emitLocal('breakout-rooms-closed');
    });

    room.on('broadcast', { event: 'breakout-assigned' }, ({ payload }) => {
      if (!payload || payload.to !== this.id) return;
      this.emitLocal('breakout-assigned', { breakoutRoomId: payload.breakoutRoomId });
    });

    room.on('broadcast', { event: 'caption' }, ({ payload }) => {
      if (!payload || payload.peerId === this.id) return;
      this.emitLocal('new-caption', payload);
    });

    room.on('broadcast', { event: 'state-request' }, ({ payload }) => {
      if (!payload || payload.to !== this.id) return;
      this.sendStateTo(payload.from);
    });

    room.on('broadcast', { event: 'state-response' }, ({ payload }) => {
      if (!payload || payload.to !== this.id) return;
      const buf = this.snapshotBuffer;
      if (!buf) return;
      clearTimeout(buf.timer);
      if (Array.isArray(payload.chatMessages)) buf.chatMessages = payload.chatMessages;
      if (Array.isArray(payload.breakoutRooms)) buf.breakoutRooms = payload.breakoutRooms;
      if (Array.isArray(payload.strokes)) {
        payload.strokes.forEach((stroke) => buf.strokes.push(stroke));
      }
      if (!payload.done) {
        // Long boards arrive as several broadcasts; keep waiting for the tail.
        buf.timer = setTimeout(() => this.finishSnapshot(buf), SNAPSHOT_TIMEOUT_MS);
        return;
      }
      this.finishSnapshot(buf);
    });

    room.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        const wasSubscribed = this.roomSubscribed;
        this.roomSubscribed = true;
        this.trackRoom();
        if (!this.roomJoined) {
          this.completeJoin();
        } else if (wasSubscribed) {
          // Reconnected after a drop: rebuild the mesh with everyone present now.
          const partners = this.currentRoomParticipants();
          this.knownPeers = new Set(partners.map((p) => p.id));
          this.participants = new Map(partners.map((p) => [p.id, p]));
          this.emitLocal('room-joined', {
            roomId: this.roomId,
            peerId: this.id,
            isHost: this.hostId === this.id,
            participants: partners,
            chatHistory: this.chatHistory.slice(-50),
            whiteboardStrokes: this.strokes,
            breakoutRooms: this.breakoutRooms,
          });
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn(`[supabase-signaling] room channel ${status.toLowerCase()}`);
      }
    });
  }

  currentRoomParticipants() {
    const map = new Map();
    presenceList(this.room).forEach((entry) => {
      if (entry.peerId && entry.peerId !== this.id) {
        map.set(entry.peerId, this.toParticipant(entry));
      }
    });
    return [...map.values()];
  }

  toParticipant(entry) {
    return {
      id: entry.peerId,
      userName: entry.userName || 'Participant',
      userAvatar: entry.userAvatar || '',
      audio: entry.audio !== false,
      video: entry.video !== false,
      screen: false,
      handRaised: !!entry.handRaised,
      isHost: this.hostId ? entry.peerId === this.hostId : !!entry.isHost,
      joinedAt: Number(entry.joinedAt) || 0,
    };
  }

  async completeJoin() {
    if (this.roomJoined || this.disconnected) return;

    // Only wait for room presence if someone else is already admitted;
    // otherwise the host would sit through the timeout on every new call.
    const admittedPeers = [...this.lobbyPresences.values()].filter(
      (p) => p.admitted && p.peerId && p.peerId !== this.id,
    );
    const partners = admittedPeers.length
      ? await this.waitForPartners(PARTNER_WAIT_MS)
      : this.currentRoomParticipants();
    let snapshot = null;
    if (partners.length > 0 && this.hostId && this.hostId !== this.id) {
      snapshot = await this.requestSnapshot();
    }
    if (this.roomJoined || this.disconnected) return;

    this.roomJoined = true;
    this.knownPeers = new Set(partners.map((p) => p.id));
    this.participants = new Map(partners.map((p) => [p.id, p]));

    const chatHistory = snapshot?.chatMessages || this.chatHistory.slice(-50);
    const whiteboardStrokes = snapshot?.whiteboardStrokes || this.strokes;
    const breakoutRooms = snapshot?.breakoutRooms || this.breakoutRooms;

    this.chatHistory = Array.isArray(chatHistory)
      ? chatHistory.slice(-MAX_CHAT_HISTORY)
      : this.chatHistory;
    this.strokes = Array.isArray(whiteboardStrokes) ? whiteboardStrokes : this.strokes;
    this.breakoutRooms = Array.isArray(breakoutRooms) ? breakoutRooms : this.breakoutRooms;

    this.emitLocal('room-joined', {
      roomId: this.roomId,
      peerId: this.id,
      isHost: this.hostId === this.id,
      participants: partners,
      chatHistory: this.chatHistory.slice(-50),
      whiteboardStrokes: this.strokes,
      breakoutRooms: this.breakoutRooms,
    });
  }

  async waitForPartners(timeout) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const partners = this.currentRoomParticipants();
      if (partners.length) return partners;
      await delay(50);
    }
    return this.currentRoomParticipants();
  }

  requestSnapshot() {
    return new Promise((resolve) => {
      const buf = {
        chatMessages: null,
        breakoutRooms: null,
        strokes: [],
        resolve,
        timer: null,
      };
      buf.timer = setTimeout(() => this.finishSnapshot(buf), SNAPSHOT_TIMEOUT_MS);
      this.snapshotBuffer = buf;
      this.sendRoom('state-request', { to: this.hostId, from: this.id });
    });
  }

  finishSnapshot(buf) {
    if (this.snapshotBuffer !== buf) return;
    clearTimeout(buf.timer);
    this.snapshotBuffer = null;
    if (!buf.chatMessages && !buf.breakoutRooms && !buf.strokes.length) {
      buf.resolve(null);
      return;
    }
    buf.resolve({
      chatMessages: buf.chatMessages || [],
      whiteboardStrokes: buf.strokes,
      breakoutRooms: buf.breakoutRooms || [],
    });
  }

  async sendStateTo(peerId) {
    const strokes = this.strokes;
    if (!strokes.length) {
      this.sendRoom('state-response', {
        to: peerId,
        chatMessages: this.chatHistory.slice(-50),
        breakoutRooms: this.breakoutRooms,
        strokes: [],
        done: true,
      });
      return;
    }

    for (let i = 0; i < strokes.length; i += SNAPSHOT_CHUNK_STROKES) {
      const end = i + SNAPSHOT_CHUNK_STROKES;
      this.sendRoom('state-response', {
        to: peerId,
        chatMessages: i === 0 ? this.chatHistory.slice(-50) : undefined,
        breakoutRooms: i === 0 ? this.breakoutRooms : undefined,
        strokes: strokes.slice(i, end),
        done: end >= strokes.length,
      });
      if (end < strokes.length) await delay(20);
    }
  }

  scheduleReconcile() {
    if (this.reconcileTimer) return;
    this.reconcileTimer = setTimeout(() => {
      this.reconcileTimer = null;
      this.reconcileParticipants();
    }, 40);
  }

  reconcileParticipants() {
    const current = new Map(this.currentRoomParticipants().map((p) => [p.id, p]));
    if (!this.roomJoined) {
      this.knownPeers = new Set(current.keys());
      return;
    }

    current.forEach((participant, id) => {
      if (!this.knownPeers.has(id)) this.emitLocal('user-connected', participant);
    });
    this.knownPeers.forEach((id) => {
      if (!current.has(id)) this.emitLocal('user-disconnected', { peerId: id });
    });

    this.knownPeers = new Set(current.keys());
    this.participants = current;
  }

  trackRoom() {
    if (!this.room || !this.roomSubscribed || this.disconnected) return;
    this.room
      .track({
        peerId: this.id,
        userName: this.userName,
        userAvatar: '',
        audio: this.media.audio,
        video: this.media.video,
        handRaised: this.media.handRaised,
        isHost: this.hostId === this.id,
        joinedAt: this.joinedAt,
      })
      .catch((err) => console.warn('[supabase-signaling] room track failed:', err));
  }

  sendRoom(event, payload) {
    if (!this.room || this.disconnected) return;
    this.room
      .send({ type: 'broadcast', event, payload })
      .catch((err) => console.warn(`[supabase-signaling] broadcast "${event}" failed:`, err));
  }

  // ---------------------------------------------------------------------------
  // Socket.io-compatible client API
  // ---------------------------------------------------------------------------

  emit(event, payload = {}) {
    switch (event) {
      case 'join-room':
        this.joinRoom(payload);
        break;

      case 'signal':
        this.sendRoom('signal', {
          to: payload.to,
          from: this.id,
          signal: payload.signal,
          meta: payload.meta,
        });
        break;

      case 'toggle-media': {
        const { type, enabled } = payload;
        if (type === 'audio' || type === 'video') this.media[type] = enabled;
        this.trackRoom();
        this.sendRoom('media', { peerId: this.id, type, enabled });
        break;
      }

      case 'toggle-hand': {
        this.media.handRaised = !!payload.raised;
        this.trackRoom();
        const data = {
          peerId: this.id,
          senderName: payload.senderName || this.userName,
          raised: !!payload.raised,
        };
        this.emitLocal('user-hand-toggled', data);
        this.sendRoom('hand', data);
        break;
      }

      case 'send-message': {
        const message = {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          senderId: this.id,
          senderName: payload.senderName || 'Anonymous',
          text: payload.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isHost: this.hostId === this.id,
        };
        this.chatHistory.push(message);
        if (this.chatHistory.length > MAX_CHAT_HISTORY) this.chatHistory.shift();
        this.emitLocal('new-message', message);
        this.sendRoom('message', { message });
        break;
      }

      case 'send-reaction': {
        const data = {
          peerId: this.id,
          senderName: payload.senderName || this.userName,
          emoji: payload.emoji,
          timestamp: Date.now(),
        };
        this.emitLocal('user-reaction', data);
        this.sendRoom('reaction', data);
        break;
      }

      case 'whiteboard-draw':
        this.queueStroke(payload.stroke);
        break;

      case 'whiteboard-clear':
        this.strokes = [];
        this.strokeQueue = [];
        if (this.strokeTimer) clearTimeout(this.strokeTimer);
        this.strokeTimer = null;
        this.emitLocal('whiteboard-clear');
        this.sendRoom('whiteboard-clear', {});
        break;

      case 'create-breakout-rooms': {
        const count = Math.max(1, Number(payload.count) || 1);
        const names = payload.roomNames;
        const list = Array.from({ length: count }, (_, i) => ({
          id: `${this.roomId}-b${i + 1}`,
          name: names?.[i] || `Breakout Room ${i + 1}`,
          participants: [],
        }));
        this.breakoutRooms = list;
        this.emitLocal('breakout-rooms-updated', list);
        this.sendRoom('breakout-updated', { rooms: list });
        break;
      }

      case 'close-breakout-rooms':
        this.breakoutRooms = [];
        this.emitLocal('breakout-rooms-closed');
        this.sendRoom('breakout-closed', {});
        break;

      case 'assign-breakout-room':
        this.sendRoom('breakout-assigned', {
          to: payload.targetPeerId,
          breakoutRoomId: payload.breakoutRoomId,
        });
        break;

      case 'send-caption':
        this.sendRoom('caption', {
          peerId: this.id,
          senderName: payload.senderName || this.userName,
          text: payload.text,
          lang: payload.lang || 'en-IN',
          timestamp: Date.now(),
        });
        break;

      case 'host-lobby-decision': {
        if (!this.lobby) break;
        this.lobby
          .send({
            type: 'broadcast',
            event: 'lobby-decision',
            payload: { to: payload.targetPeerId, approved: !!payload.approved },
          })
          .catch((err) => console.warn('[supabase-signaling] lobby decision failed:', err));
        this.knownWaiting.delete(payload.targetPeerId);
        break;
      }

      default:
        break;
    }
    return this;
  }

  queueStroke(stroke) {
    if (!stroke || this.disconnected) return;
    this.strokes.push(stroke);
    if (this.strokes.length > MAX_STROKES) this.strokes = this.strokes.slice(-MAX_STROKES);

    this.strokeQueue.push(stroke);
    if (this.strokeTimer) return;
    this.strokeTimer = setTimeout(() => this.flushStrokes(), STROKE_FLUSH_MS);
  }

  flushStrokes() {
    this.strokeTimer = null;
    if (!this.strokeQueue.length) return;
    const strokes = this.strokeQueue.splice(0, this.strokeQueue.length);
    this.sendRoom('whiteboard-strokes', { strokes });
  }

  disconnect() {
    if (this.disconnected) return;
    this.flushStrokes();
    this.disconnected = true;
    if (this.lobbyTimer) clearTimeout(this.lobbyTimer);

    if (this.room) {
      this.room.untrack?.();
      this.supabase.removeChannel(this.room);
      this.room = null;
    }
    if (this.lobby) {
      this.lobby.untrack?.();
      this.supabase.removeChannel(this.lobby);
      this.lobby = null;
    }

    this.handlers.clear();
    this.snapshotBuffer = null;
  }
}
