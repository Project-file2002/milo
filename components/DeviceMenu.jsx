'use client';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronUp, Check } from 'lucide-react';

const MENU_WIDTH = 300;
const VIEWPORT_MARGIN = 12;

// Chevron + dropdown to switch between available microphones / cameras.
// The dropdown renders in a portal so parent containers with overflow:hidden
// (video cards) or the viewport edge can never clip it.
export default function DeviceMenu({ kind = 'audio', localStream = null, onSelect = () => {} }) {
  const [open, setOpen] = useState(false);
  const [devices, setDevices] = useState([]);
  const [pos, setPos] = useState(null);
  const rootRef = useRef(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let retryTimer = null;

    const load = async (attempt = 0) => {
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        const wanted = kind === 'audio' ? 'audioinput' : 'videoinput';
        const filtered = list.filter((d) => d.kind === wanted);
        // Chrome can briefly return an empty list while permissions/media settle
        if (filtered.length === 0 && attempt < 3) {
          retryTimer = setTimeout(() => load(attempt + 1), 400);
          return;
        }
        setDevices(filtered);
      } catch (e) {
        if (!cancelled) setDevices([]);
      }
    };

    load();
    const md = navigator.mediaDevices;
    const onDeviceChange = () => load();
    if (md && md.addEventListener) md.addEventListener('devicechange', onDeviceChange);

    const onDocDown = (e) => {
      const insideRoot = rootRef.current && rootRef.current.contains(e.target);
      const insideMenu = menuRef.current && menuRef.current.contains(e.target);
      if (!insideRoot && !insideMenu) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (md && md.removeEventListener) md.removeEventListener('devicechange', onDeviceChange);
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, kind]);

  const reposition = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(MENU_WIDTH, vw - VIEWPORT_MARGIN * 2);
    const height = menuRef.current ? menuRef.current.offsetHeight : 220;
    const left = Math.min(Math.max(r.right - width, VIEWPORT_MARGIN), vw - width - VIEWPORT_MARGIN);
    let top = r.top - height - 8;
    if (top < VIEWPORT_MARGIN) top = Math.min(r.bottom + 8, vh - height - VIEWPORT_MARGIN);
    return { left, top, width, maxHeight: Math.max(140, Math.min(320, vh - VIEWPORT_MARGIN * 2)) };
  };

  useLayoutEffect(() => {
    if (!open) return;
    setPos(reposition());
  }, [open, devices]);

  useEffect(() => {
    if (!open) return undefined;
    const update = () => setPos(reposition());
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  const track = localStream
    ? (kind === 'audio' ? localStream.getAudioTracks()[0] : localStream.getVideoTracks()[0])
    : null;
  const activeId = track && track.getSettings ? track.getSettings().deviceId : undefined;

  const labelText = kind === 'audio' ? 'Microphone' : 'Camera';
  const emptyText = kind === 'audio' ? 'No microphone found' : 'No camera found';

  const menu = open && (
    <div
      ref={menuRef}
      data-device-menu={kind}
      style={{
        position: 'fixed',
        left: pos ? pos.left : 0,
        top: pos ? pos.top : 0,
        width: pos ? pos.width : MENU_WIDTH,
        maxWidth: `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`,
        maxHeight: pos ? pos.maxHeight : 320,
        overflowY: 'auto',
        overflowX: 'hidden',
        backgroundColor: '#303134',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        padding: '8px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        zIndex: 120,
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
          color: '#9aa0a6',
          padding: '4px 10px 8px',
        }}
      >
        {labelText}
      </div>

      {devices.length === 0 && (
        <div style={{ padding: '8px 10px', fontSize: '13px', color: '#9aa0a6' }}>{emptyText}</div>
      )}

      {devices.map((d, i) => {
        const isActive = !!d.deviceId && d.deviceId === activeId;
        return (
          <button
            key={d.deviceId || `${kind}-${i}`}
            onClick={() => {
              onSelect(d.deviceId);
              setOpen(false);
            }}
            title={d.label || `${labelText} ${i + 1}`}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 10px',
              borderRadius: '8px',
              backgroundColor: isActive ? 'rgba(138,180,248,0.15)' : 'transparent',
              color: '#e8eaed',
              fontSize: '13px',
              textAlign: 'left',
            }}
          >
            <span style={{ width: '16px', flex: '0 0 16px', display: 'flex', justifyContent: 'center' }}>
              {isActive && <Check size={14} color="#8ab4f8" />}
            </span>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {d.label || `${labelText} ${i + 1}`}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'flex' }}>
      <button
        ref={btnRef}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title={kind === 'audio' ? 'Select microphone' : 'Select camera'}
        aria-label={kind === 'audio' ? 'Select microphone' : 'Select camera'}
        style={{
          width: '22px',
          height: '100%',
          minHeight: '40px',
          borderRadius: '0 24px 24px 0',
          backgroundColor: 'transparent',
          borderLeft: '1px solid rgba(255,255,255,0.12)',
          color: '#e8eaed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ChevronUp
          size={14}
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        />
      </button>

      {menu && typeof document !== 'undefined' ? createPortal(menu, document.body) : null}
    </div>
  );
}
