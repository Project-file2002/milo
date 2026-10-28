'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Mic,
  Video,
  SlidersHorizontal,
  X,
  Volume2,
  Check,
  RotateCcw,
} from 'lucide-react';
import { loadSettings, saveSettings, defaultSettings, INDIAN_LANGUAGES } from '@/lib/settings';

const TABS = [
  { id: 'audio', label: 'Audio', icon: Mic },
  { id: 'video', label: 'Video', icon: Video },
  { id: 'general', label: 'General', icon: SlidersHorizontal },
];

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '16px',
  padding: '14px 0',
  borderBottom: '1px solid rgba(255,255,255,0.07)',
};

const selectStyle = {
  height: '40px',
  minWidth: '220px',
  maxWidth: '300px',
  padding: '0 10px',
  backgroundColor: '#202124',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: '8px',
  color: '#e8eaed',
  fontSize: '13px',
  outline: 'none',
};

const labelStyle = { fontSize: '14px', color: '#e8eaed', fontWeight: '500' };
const hintStyle = { fontSize: '12px', color: '#9aa0a6', marginTop: '2px' };

export default function SettingsModal({ open = false, onClose = () => {} }) {
  const [tab, setTab] = useState('audio');
  const [settings, setSettings] = useState(defaultSettings);
  const [micDevices, setMicDevices] = useState([]);
  const [camDevices, setCamDevices] = useState([]);
  const [speakerDevices, setSpeakerDevices] = useState([]);
  const [micLevel, setMicLevel] = useState(0);
  const [camError, setCamError] = useState('');
  const previewRef = useRef(null);

  const update = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (open) {
      setSettings(loadSettings());
      setTab('audio');
    }
  }, [open]);

  // Enumerate devices (labels appear once the matching permission is granted)
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;

    const enumerate = async () => {
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        setMicDevices(list.filter((d) => d.kind === 'audioinput'));
        setCamDevices(list.filter((d) => d.kind === 'videoinput'));
        setSpeakerDevices(list.filter((d) => d.kind === 'audiooutput'));
      } catch (e) {
        if (!cancelled) {
          setMicDevices([]);
          setCamDevices([]);
          setSpeakerDevices([]);
        }
      }
    };

    enumerate();
    const md = navigator.mediaDevices;
    if (md && md.addEventListener) md.addEventListener('devicechange', enumerate);
    return () => {
      cancelled = true;
      if (md && md.removeEventListener) md.removeEventListener('devicechange', enumerate);
    };
  }, [open]);

  // Live microphone test while the Audio tab is open
  useEffect(() => {
    if (!open || tab !== 'audio') return undefined;
    let cancelled = false;
    let stream = null;
    let audioCtx = null;
    let raf = 0;

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: settings.microphoneId ? { deviceId: { exact: settings.microphoneId } } : true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        audioCtx.createMediaStreamSource(stream).connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          setMicLevel(Math.min(1, Math.sqrt(sum / data.length) * 6));
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch (e) {
        setMicLevel(0);
      }
    };

    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (audioCtx) audioCtx.close().catch(() => {});
    };
  }, [open, tab, settings.microphoneId]);

  // Live camera preview while the Video tab is open
  useEffect(() => {
    if (!open || tab !== 'video') return undefined;
    let cancelled = false;
    let stream = null;
    setCamError('');

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: settings.cameraId
            ? { deviceId: { exact: settings.cameraId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (previewRef.current) previewRef.current.srcObject = stream;
      } catch (e) {
        if (!cancelled) setCamError('Camera unavailable — check browser permissions.');
      }
    };

    start();
    return () => {
      cancelled = true;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (previewRef.current) previewRef.current.srcObject = null;
    };
  }, [open, tab, settings.cameraId]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const toggle = (checked) => (
    <div
      style={{
        width: '36px',
        height: '20px',
        borderRadius: '10px',
        backgroundColor: checked ? '#34a853' : '#5f6368',
        position: 'relative',
        transition: 'background 0.2s',
        flex: '0 0 36px',
      }}
    >
      <div
        style={{
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          backgroundColor: '#fff',
          position: 'absolute',
          top: '2px',
          left: checked ? '18px' : '2px',
          transition: 'left 0.2s',
        }}
      />
    </div>
  );

  const modal = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        zIndex: 200,
      }}
      className="animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-settings-modal
        role="dialog"
        aria-modal="true"
        aria-label="Milo settings"
        style={{
          width: '100%',
          maxWidth: '760px',
          maxHeight: 'min(640px, 92vh)',
          backgroundColor: '#28292c',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            height: '60px',
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: '500', color: '#e8eaed' }}>Settings</h2>
          <button
            onClick={onClose}
            title="Close settings"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9aa0a6',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Tab rail */}
          <div
            style={{
              width: '190px',
              padding: '12px 8px',
              borderRight: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                data-settings-tab={id}
                onClick={() => setTab(id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: tab === id ? 'rgba(138,180,248,0.16)' : 'transparent',
                  color: tab === id ? '#8ab4f8' : '#e8eaed',
                  fontSize: '14px',
                  fontWeight: tab === id ? '600' : '400',
                  textAlign: 'left',
                }}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, padding: '8px 24px', overflowY: 'auto' }}>
            {tab === 'audio' && (
              <div>
                <div style={rowStyle}>
                  <div>
                    <div style={labelStyle}>Microphone</div>
                    <div style={hintStyle}>Choose the mic Milo should use in meetings</div>
                  </div>
                  <select
                    data-setting="microphone"
                    value={settings.microphoneId}
                    onChange={(e) => update({ microphoneId: e.target.value })}
                    style={selectStyle}
                  >
                    <option value="">System default</option>
                    {micDevices.map((d, i) => (
                      <option key={d.deviceId || `mic-${i}`} value={d.deviceId}>
                        {d.label || `Microphone ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={rowStyle}>
                  <div>
                    <div style={labelStyle}>Speaker</div>
                    <div style={hintStyle}>Output device preference for this browser</div>
                  </div>
                  <select
                    data-setting="speaker"
                    value={settings.speakerId}
                    onChange={(e) => update({ speakerId: e.target.value })}
                    style={selectStyle}
                  >
                    <option value="">System default</option>
                    {speakerDevices.map((d, i) => (
                      <option key={d.deviceId || `spk-${i}`} value={d.deviceId}>
                        {d.label || `Speaker ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ padding: '18px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <Volume2 size={16} color="#8ab4f8" />
                    <span style={{ ...labelStyle, fontSize: '13px' }}>Test your microphone</span>
                  </div>
                  <div
                    data-mic-test-meter
                    style={{
                      height: '8px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(255,255,255,0.12)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.round(micLevel * 100)}%`,
                        height: '100%',
                        backgroundColor: micLevel > 0.05 ? '#34a853' : '#5f6368',
                        transition: 'width 0.08s linear',
                      }}
                    />
                  </div>
                  <div style={{ ...hintStyle, marginTop: '8px' }}>
                    Speak now — the bar should move when your mic is working.
                  </div>
                </div>
              </div>
            )}

            {tab === 'video' && (
              <div>
                <div style={rowStyle}>
                  <div>
                    <div style={labelStyle}>Camera</div>
                    <div style={hintStyle}>Choose the camera Milo should use in meetings</div>
                  </div>
                  <select
                    data-setting="camera"
                    value={settings.cameraId}
                    onChange={(e) => update({ cameraId: e.target.value })}
                    style={selectStyle}
                  >
                    <option value="">System default</option>
                    {camDevices.map((d, i) => (
                      <option key={d.deviceId || `cam-${i}`} value={d.deviceId}>
                        {d.label || `Camera ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ padding: '18px 0' }}>
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      maxWidth: '420px',
                      aspectRatio: '16 / 9',
                      backgroundColor: '#202124',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      border: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <video
                      ref={previewRef}
                      autoPlay
                      playsInline
                      muted
                      data-camera-preview
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transform: 'scaleX(-1)',
                        display: camError ? 'none' : 'block',
                      }}
                    />
                    {camError && (
                      <span style={{ fontSize: '13px', color: '#9aa0a6', padding: '0 16px', textAlign: 'center' }}>
                        {camError}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {tab === 'general' && (
              <div>
                <div style={rowStyle}>
                  <div>
                    <div style={labelStyle}>Display name</div>
                    <div style={hintStyle}>Pre-filled when you enter a meeting</div>
                  </div>
                  <input
                    data-setting="displayName"
                    value={settings.displayName}
                    onChange={(e) => update({ displayName: e.target.value })}
                    placeholder="Your name"
                    style={{ ...selectStyle, width: '260px' }}
                  />
                </div>

                <button
                  onClick={() => update({ lowDataDefault: !settings.lowDataDefault })}
                  data-setting="lowDataDefault"
                  aria-pressed={settings.lowDataDefault}
                  style={{ ...rowStyle, width: '100%', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div style={{ textAlign: 'left' }}>
                    <div style={labelStyle}>Start meetings in Low Data mode</div>
                    <div style={hintStyle}>Caps video at 120 kbps for weak 4G / rural connections</div>
                  </div>
                  {toggle(settings.lowDataDefault)}
                </button>

                <div style={rowStyle}>
                  <div>
                    <div style={labelStyle}>Captions language</div>
                    <div style={hintStyle}>Default speech-to-text language for live captions</div>
                  </div>
                  <select
                    data-setting="captionLanguage"
                    value={settings.captionLanguage}
                    onChange={(e) => update({ captionLanguage: e.target.value })}
                    style={selectStyle}
                  >
                    {INDIAN_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '18px 0' }}>
                  <button
                    onClick={() => {
                      setSettings({ ...defaultSettings });
                      saveSettings(defaultSettings);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.14)',
                      color: '#e8eaed',
                      fontSize: '13px',
                    }}
                  >
                    <RotateCcw size={15} /> Reset to defaults
                  </button>
                  <span style={hintStyle}>Preferences are stored in this browser only.</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            height: '60px',
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#81c995' }}>
            <Check size={14} /> Changes save automatically
          </span>
          <button
            onClick={onClose}
            data-settings-done
            style={{
              padding: '9px 26px',
              borderRadius: '20px',
              backgroundColor: '#1a73e8',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '600',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
