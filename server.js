import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// In-memory state for active meeting rooms
const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      hostId: null,
      title: 'Milo Conference',
      participants: new Map(), // peerId -> { id, userName, userAvatar, audio, video, screen, handRaised, isHost, joinedAt }
      waitingRoom: new Map(), // peerId -> { id, userName, userAvatar, requestedAt }
      whiteboardStrokes: [],
      breakoutRooms: [], // [{ id, name, participants: [] }]
      chatMessages: [],
      captionsLog: []
    });
  }
  return rooms.get(roomId);
}

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
  });

  io.on('connection', (socket) => {
    const peerId = socket.id;

    // 1. Join Room / Request to Join
    socket.on('join-room', ({ roomId, userName, userAvatar, isHostIntent }) => {
      const room = getOrCreateRoom(roomId);
      socket.join(roomId);

      // Determine if user becomes host (first to join or explicitly created as host)
      const isFirstParticipant = room.participants.size === 0;
      const isHost = isFirstParticipant || isHostIntent === true;

      if (isHost && !room.hostId) {
        room.hostId = peerId;
      }

      // If room already has a host and caller is not host, check if waiting room is enabled
      const needsApproval = !isHost && room.hostId && room.participants.size > 0;

      if (needsApproval && !isHostIntent) {
        // Put in waiting room
        room.waitingRoom.set(peerId, {
          id: peerId,
          userName: userName || 'Guest Participant',
          userAvatar: userAvatar || '',
          requestedAt: Date.now()
        });

        // Notify host about guest in waiting room
        io.to(room.hostId).emit('waiting-room-request', {
          peerId,
          userName: userName || 'Guest Participant',
          userAvatar
        });

        // Inform guest they are waiting
        socket.emit('waiting-for-host');
        return;
      }

      // Admit directly
      admitParticipantToRoom(room, socket, {
        peerId,
        userName,
        userAvatar,
        isHost
      });
    });

    // 2. Host decides on waiting room guest
    socket.on('host-lobby-decision', ({ roomId, targetPeerId, approved }) => {
      const room = rooms.get(roomId);
      if (!room || room.hostId !== peerId) return;

      const guest = room.waitingRoom.get(targetPeerId);
      if (!guest) return;

      room.waitingRoom.delete(targetPeerId);

      if (approved) {
        const guestSocket = io.sockets.sockets.get(targetPeerId);
        if (guestSocket) {
          admitParticipantToRoom(room, guestSocket, {
            peerId: targetPeerId,
            userName: guest.userName,
            userAvatar: guest.userAvatar,
            isHost: false
          });
        }
      } else {
        io.to(targetPeerId).emit('lobby-denied', { reason: 'The host has denied admission to this meeting.' });
      }
    });

    // Helper to admit participant into the call
    function admitParticipantToRoom(room, userSocket, { peerId, userName, userAvatar, isHost }) {
      const participantInfo = {
        id: peerId,
        userName: userName || 'Participant',
        userAvatar: userAvatar || '',
        audio: true,
        video: true,
        screen: false,
        handRaised: false,
        isHost,
        joinedAt: Date.now()
      };

      room.participants.set(peerId, participantInfo);
      userSocket.data.roomId = room.id;
      userSocket.data.peerId = peerId;

      // Existing participants list to send to the newcomer
      const existingPeers = Array.from(room.participants.values()).filter(p => p.id !== peerId);

      // Tell newcomer they are admitted and send existing participants list
      userSocket.emit('room-joined', {
        roomId: room.id,
        peerId,
        isHost,
        participants: existingPeers,
        chatHistory: room.chatMessages.slice(-50),
        whiteboardStrokes: room.whiteboardStrokes,
        breakoutRooms: room.breakoutRooms
      });

      // Broadcast to existing peers that a new user joined so they can prepare WebRTC handshake
      userSocket.to(room.id).emit('user-connected', participantInfo);
    }

    // 3. WebRTC Mesh Signaling (P2P Offer, Answer, ICE Candidate)
    socket.on('signal', ({ to, signal, meta }) => {
      io.to(to).emit('signal', {
        from: peerId,
        signal,
        meta
      });
    });

    // 4. Media State Toggle (Audio, Video, Screen)
    socket.on('toggle-media', ({ roomId, type, enabled }) => {
      const room = rooms.get(roomId);
      if (room && room.participants.has(peerId)) {
        const participant = room.participants.get(peerId);
        participant[type] = enabled;
        socket.to(roomId).emit('participant-media-changed', {
          peerId,
          type,
          enabled
        });
      }
    });

    // 5. In-Meeting Chat
    socket.on('send-message', ({ roomId, text, senderName }) => {
      const room = rooms.get(roomId);
      if (!room) return;

      const message = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        senderId: peerId,
        senderName: senderName || 'Anonymous',
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isHost: room.hostId === peerId
      };

      room.chatMessages.push(message);
      io.to(roomId).emit('new-message', message);
    });

    // 6. Emoji Reactions
    socket.on('send-reaction', ({ roomId, emoji, senderName }) => {
      io.to(roomId).emit('user-reaction', {
        peerId,
        senderName: senderName || 'Someone',
        emoji,
        timestamp: Date.now()
      });
    });

    // 7. Raise Hand
    socket.on('toggle-hand', ({ roomId, raised, senderName }) => {
      const room = rooms.get(roomId);
      if (room && room.participants.has(peerId)) {
        const p = room.participants.get(peerId);
        p.handRaised = raised;
        io.to(roomId).emit('user-hand-toggled', {
          peerId,
          senderName: senderName || p.userName,
          raised
        });
      }
    });

    // 8. Whiteboard Synchronization ('Milo Board')
    socket.on('whiteboard-draw', ({ roomId, stroke }) => {
      const room = rooms.get(roomId);
      if (room) {
        room.whiteboardStrokes.push(stroke);
        socket.to(roomId).emit('whiteboard-draw', stroke);
      }
    });

    socket.on('whiteboard-clear', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (room) {
        room.whiteboardStrokes = [];
        io.to(roomId).emit('whiteboard-clear');
      }
    });

    // 9. Breakout Rooms Management
    socket.on('create-breakout-rooms', ({ roomId, count, roomNames }) => {
      const room = rooms.get(roomId);
      if (!room || room.hostId !== peerId) return;

      const list = [];
      for (let i = 0; i < count; i++) {
        list.push({
          id: `${roomId}-b${i + 1}`,
          name: roomNames?.[i] || `Breakout Room ${i + 1}`,
          participants: []
        });
      }
      room.breakoutRooms = list;
      io.to(roomId).emit('breakout-rooms-updated', list);
    });

    socket.on('assign-breakout-room', ({ roomId, targetPeerId, breakoutRoomId }) => {
      const room = rooms.get(roomId);
      if (!room || room.hostId !== peerId) return;

      io.to(targetPeerId).emit('breakout-assigned', { breakoutRoomId });
    });

    socket.on('close-breakout-rooms', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room || room.hostId !== peerId) return;

      room.breakoutRooms = [];
      io.to(roomId).emit('breakout-rooms-closed');
    });

    // 10. Live Captions (Speech-to-Text)
    socket.on('send-caption', ({ roomId, text, lang, senderName }) => {
      const room = rooms.get(roomId);
      if (room) {
        const captionEntry = {
          peerId,
          senderName: senderName || 'Speaker',
          text,
          lang: lang || 'en-IN',
          timestamp: Date.now()
        };
        room.captionsLog.push(captionEntry);
        // Keep last 100 captions for post-call AI notes
        if (room.captionsLog.length > 100) room.captionsLog.shift();

        io.to(roomId).emit('new-caption', captionEntry);
      }
    });

    // 11. Disconnect / Leave
    socket.on('disconnect', () => {
      const roomId = socket.data.roomId;
      if (!roomId) return;

      const room = rooms.get(roomId);
      if (!room) return;

      // If user was in waiting room
      if (room.waitingRoom.has(peerId)) {
        room.waitingRoom.delete(peerId);
        if (room.hostId) {
          io.to(room.hostId).emit('waiting-room-left', { peerId });
        }
      }

      // If user was participant
      if (room.participants.has(peerId)) {
        const departing = room.participants.get(peerId);
        room.participants.delete(peerId);

        // Notify room
        io.to(roomId).emit('user-disconnected', {
          peerId,
          userName: departing.userName
        });

        // If host left, reassign host to oldest participant or reset
        if (room.hostId === peerId) {
          if (room.participants.size > 0) {
            const nextHost = room.participants.values().next().value;
            room.hostId = nextHost.id;
            nextHost.isHost = true;
            io.to(roomId).emit('host-changed', { newHostId: nextHost.id, hostName: nextHost.userName });
          } else {
            room.hostId = null;
          }
        }
      }

      // Clean up empty room after 10 minutes of inactivity
      if (room.participants.size === 0 && room.waitingRoom.size === 0) {
        setTimeout(() => {
          const current = rooms.get(roomId);
          if (current && current.participants.size === 0) {
            rooms.delete(roomId);
          }
        }, 10 * 60 * 1000);
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Milo Video Server ready on http://${hostname}:${port}`);
    console.log(`> Signaling and WebRTC Mesh active`);
  });
});
