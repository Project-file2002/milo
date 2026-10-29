'use client';

import { io } from 'socket.io-client';
import { getSupabaseConfig } from './supabaseClient.js';
import { SupabaseSignaling } from './signalingSupabase.js';

// One meeting transport, two backends:
//   Supabase Realtime (serverless, works on Vercel) when the public keys are set
//   Socket.io (server.js) otherwise, e.g. local dev / Render / Railway
export function getSignalingTransport() {
  return getSupabaseConfig() ? 'supabase' : 'socketio';
}

export function createSignaling({ roomId, userName, isHostIntent = false }) {
  if (getSupabaseConfig()) {
    return new SupabaseSignaling({ roomId, userName, isHostIntent });
  }

  const signalingUrl = (
    process.env.NEXT_PUBLIC_SIGNALING_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  ).replace(/\/$/, '');
  return io(signalingUrl, { transports: ['websocket', 'polling'] });
}
