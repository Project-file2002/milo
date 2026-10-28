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
  }

  setLocalStream(newStream) {
    this.localStream = newStream;
    // Update tracks in existing peer connections
    this.peers.forEach((pc) => {
      const senders = pc.getSenders();
      const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');
      const videoSender = senders.find((s) => s.track && s.track.kind === 'video');

      if (newStream) {
        const newAudioTrack = newStream.getAudioTracks()[0];
        const newVideoTrack = newStream.getVideoTracks()[0];

        if (audioSender && newAudioTrack) {
          audioSender.replaceTrack(newAudioTrack).catch(console.error);
        } else if (!audioSender && newAudioTrack) {
          pc.addTrack(newAudioTrack, newStream);
        }

        if (videoSender && newVideoTrack) {
          videoSender.replaceTrack(newVideoTrack).catch(console.error);
        } else if (!videoSender && newVideoTrack) {
          pc.addTrack(newVideoTrack, newStream);
        }
      }
    });
  }

  replaceVideoTrack(track) {
    this.peers.forEach((pc) => {
      const senders = pc.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
      if (videoSender && track) {
        videoSender.replaceTrack(track).catch(console.error);
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

    // Receive Remote Media Stream
    pc.ontrack = (event) => {
      let stream = this.remoteStreams.get(targetPeerId);
      if (!stream) {
        stream = new MediaStream();
        this.remoteStreams.set(targetPeerId, stream);
      }
      stream.addTrack(event.track);
      if (this.onRemoteStream) {
        this.onRemoteStream(targetPeerId, stream);
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
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.sendSignal({
          to: fromPeerId,
          signal: { type: 'answer', sdp: pc.localDescription },
        });
      } catch (err) {
        console.error(`Error handling offer from ${fromPeerId}:`, err);
      }
    } else if (signal.type === 'answer') {
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        } catch (err) {
          console.error(`Error handling answer from ${fromPeerId}:`, err);
        }
      }
    } else if (signal.type === 'candidate') {
      if (pc && signal.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (err) {
          console.error(`Error adding ICE candidate from ${fromPeerId}:`, err);
        }
      }
    }
  }

  closePeer(targetPeerId) {
    const pc = this.peers.get(targetPeerId);
    if (pc) {
      pc.close();
      this.peers.delete(targetPeerId);
    }
    this.remoteStreams.delete(targetPeerId);
    if (this.onPeerDisconnected) {
      this.onPeerDisconnected(targetPeerId);
    }
  }

  closeAll() {
    this.peers.forEach((pc) => pc.close());
    this.peers.clear();
    this.remoteStreams.clear();
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
