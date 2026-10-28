// WebRTC Mesh Manager for Milo
export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

export class WebRTCManager {
  constructor({ localStream, onRemoteStream, onPeerDisconnected, sendSignal }) {
    this.localStream = localStream;
    this.onRemoteStream = onRemoteStream;
    this.onPeerDisconnected = onPeerDisconnected;
    this.sendSignal = sendSignal;
    this.peers = new Map(); // targetPeerId -> RTCPeerConnection
    this.remoteStreams = new Map(); // targetPeerId -> MediaStream
    this.peerStates = new Map(); // targetPeerId -> { pendingCandidates, remoteDescriptionSet }
    this.pendingNegotiations = new Set(); // peers that need an offer once signaling returns to stable
    this.attachedStream = null; // stream currently wired into peer connections
  }

  getPeerState(targetPeerId) {
    let state = this.peerStates.get(targetPeerId);
    if (!state) {
      state = { pendingCandidates: [], remoteDescriptionSet: false };
      this.peerStates.set(targetPeerId, state);
    }
    return state;
  }

  setLocalStream(newStream) {
    this.localStream = newStream;
    if (!newStream) return;

    const sameTracks =
      this.attachedStream &&
      JSON.stringify(this.attachedStream.getTracks().map((t) => t.id)) ===
        JSON.stringify(newStream.getTracks().map((t) => t.id));
    if (sameTracks) return;

    // Update tracks in existing peer connections and renegotiate when new senders are added
    this.peers.forEach((pc, targetPeerId) => {
      let needsRenegotiation = false;
      const senders = pc.getSenders();
      const audioTrack = newStream.getAudioTracks()[0];
      const videoTrack = newStream.getVideoTracks()[0];

      const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');
      const videoSender = senders.find((s) => s.track && s.track.kind === 'video');

      if (audioTrack) {
        if (audioSender) audioSender.replaceTrack(audioTrack).catch(console.error);
        else { pc.addTrack(audioTrack, newStream); needsRenegotiation = true; }
      }
      if (videoTrack) {
        if (videoSender) videoSender.replaceTrack(videoTrack).catch(console.error);
        else { pc.addTrack(videoTrack, newStream); needsRenegotiation = true; }
      }

      if (needsRenegotiation) {
        // setLocalStream often resolves during the join handshake; offering then
        // would throw, so remember the peer and offer once signaling is stable.
        if (pc.signalingState === 'stable') {
          this.initiateOffer(targetPeerId).catch((err) =>
            console.warn(`Renegotiation after stream swap failed for ${targetPeerId}:`, err)
          );
        } else {
          this.pendingNegotiations.add(targetPeerId);
        }
      }
    });

    this.attachedStream = newStream;
  }

  replaceVideoTrack(track) {
    this.replaceTrack('video', track);
  }

  // Swap a microphone or camera track on every peer without renegotiation
  replaceTrack(kind, track) {
    if (!track) return;
    this.peers.forEach((pc, targetPeerId) => {
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === kind);
      if (sender) {
        sender.replaceTrack(track).catch(console.error);
        return;
      }
      if (this.localStream) {
        pc.addTrack(track, this.localStream);
        if (pc.signalingState === 'stable') {
          this.initiateOffer(targetPeerId).catch((err) =>
            console.warn(`Renegotiation after ${kind} track add failed for ${targetPeerId}:`, err)
          );
        } else {
          this.pendingNegotiations.add(targetPeerId);
        }
      }
    });
  }

  // Low Data Mode bandwidth throttling for Indian 3G / 4G / rural connections
  setLowDataMode(isLowData) {
    this.peers.forEach((pc) => {
      const senders = pc.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
      if (videoSender && videoSender.getParameters) {
        try {
          const params = videoSender.getParameters();
          if (!params.encodings || params.encodings.length === 0) {
            params.encodings = [{}];
          }
          if (isLowData) {
            // Low data: max 120 kbps, 15 fps max
            params.encodings[0].maxBitrate = 120000;
            params.encodings[0].maxFramerate = 15;
          } else {
            // Standard HD: 1.5 Mbps, 30 fps
            params.encodings[0].maxBitrate = 1500000;
            delete params.encodings[0].maxFramerate;
          }
          videoSender.setParameters(params).catch(console.warn);
        } catch (e) {
          console.warn('Could not set video encoding parameters:', e);
        }
      }
    });
  }

  createPeerConnection(targetPeerId) {
    if (this.peers.has(targetPeerId)) {
      return this.peers.get(targetPeerId);
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peers.set(targetPeerId, pc);

    // Add local media tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream);
      });
      this.attachedStream = this.localStream;
    }

    // ICE Candidate event
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({
          to: targetPeerId,
          signal: { type: 'candidate', candidate: event.candidate },
        });
      }
    };

    // Receive Remote Media Stream. Keep exactly one track per kind: a stale,
    // ended track left at index 0 of a reused stream renders a blank tile even
    // though the live track arrives later.
    pc.ontrack = (event) => {
      const previous = this.remoteStreams.get(targetPeerId);
      const tracks = previous
        ? previous.getTracks().filter((t) => t.kind !== event.track.kind || t.id === event.track.id)
        : [];
      if (!tracks.some((t) => t.id === event.track.id)) tracks.push(event.track);
      const stream = new MediaStream(tracks);
      this.remoteStreams.set(targetPeerId, stream);
      if (this.onRemoteStream) {
        this.onRemoteStream(targetPeerId, stream);
      }
    };

    pc.onsignalingstatechange = () => {
      if (pc.signalingState === 'stable' && this.pendingNegotiations.delete(targetPeerId)) {
        this.initiateOffer(targetPeerId).catch((err) =>
          console.warn(`Deferred renegotiation failed for ${targetPeerId}:`, err)
        );
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.closePeer(targetPeerId);
      }
    };

    return pc;
  }

  async initiateOffer(targetPeerId) {
    const pc = this.createPeerConnection(targetPeerId);
    if (pc.signalingState !== 'stable') {
      this.pendingNegotiations.add(targetPeerId);
      return;
    }
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);
      this.sendSignal({
        to: targetPeerId,
        signal: { type: 'offer', sdp: pc.localDescription },
      });
    } catch (err) {
      console.error(`Failed to create offer for ${targetPeerId}:`, err);
    }
  }

  async handleSignal(fromPeerId, signal) {
    let pc = this.peers.get(fromPeerId);

    if (signal.type === 'offer') {
      if (!pc) {
        pc = this.createPeerConnection(fromPeerId);
      }
      const state = this.getPeerState(fromPeerId);
      if (pc.signalingState === 'have-local-offer') {
        // Glare: we are also waiting for our own answer. Accept the remote offer as the authoritative one.
        await pc.setLocalDescription({ type: 'rollback' }).catch(() => {});
      }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        state.remoteDescriptionSet = true;
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.sendSignal({
          to: fromPeerId,
          signal: { type: 'answer', sdp: pc.localDescription },
        });
        this.flushPendingCandidates(fromPeerId, pc);
      } catch (err) {
        console.error(`Error handling offer from ${fromPeerId}:`, err);
      }
    } else if (signal.type === 'answer') {
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          this.getPeerState(fromPeerId).remoteDescriptionSet = true;
          this.flushPendingCandidates(fromPeerId, pc);
        } catch (err) {
          console.error(`Error handling answer from ${fromPeerId}:`, err);
        }
      }
    } else if (signal.type === 'candidate') {
      if (signal.candidate) {
        const state = this.getPeerState(fromPeerId);
        if (!state.remoteDescriptionSet || !pc) {
          // Remote description not applied yet — queue the candidate (trickle race).
          state.pendingCandidates.push(signal.candidate);
          return;
        }
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (err) {
          console.error(`Error adding ICE candidate from ${fromPeerId}:`, err);
        }
      }
    }
  }

  flushPendingCandidates(targetPeerId, pc) {
    const state = this.getPeerState(targetPeerId);
    const queued = state.pendingCandidates.splice(0, state.pendingCandidates.length);
    queued.forEach((candidate) => {
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((err) => {
        console.warn(`Failed to flush queued ICE candidate for ${targetPeerId}:`, err);
      });
    });
  }

  closePeer(targetPeerId) {
    const pc = this.peers.get(targetPeerId);
    if (pc) {
      pc.close();
      this.peers.delete(targetPeerId);
    }
    this.remoteStreams.delete(targetPeerId);
    this.peerStates.delete(targetPeerId);
    this.pendingNegotiations.delete(targetPeerId);
    if (this.onPeerDisconnected) {
      this.onPeerDisconnected(targetPeerId);
    }
  }

  closeAll() {
    this.peers.forEach((pc) => pc.close());
    this.peers.clear();
    this.remoteStreams.clear();
    this.peerStates.clear();
    this.pendingNegotiations.clear();
  }
}

// Audio Analyser helper to detect who is currently speaking
export function createAudioSpeakerDetector(stream, onSpeakingChange) {
  if (!stream || stream.getAudioTracks().length === 0) return null;

  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.5;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let isSpeaking = false;
    let checkInterval = null;

    checkInterval = setInterval(() => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const speakingThreshold = 18; // Sensible threshold for active speech

      if (average > speakingThreshold && !isSpeaking) {
        isSpeaking = true;
        onSpeakingChange(true);
      } else if (average <= speakingThreshold && isSpeaking) {
        isSpeaking = false;
        onSpeakingChange(false);
      }
    }, 150);

    return {
      destroy: () => {
        clearInterval(checkInterval);
        try {
          source.disconnect();
          audioContext.close();
        } catch (e) {}
      },
    };
  } catch (err) {
    console.warn('AudioContext speaker detection not supported or blocked:', err);
    return null;
  }
}
