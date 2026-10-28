'use strict';
import React, { useRef, useState, useEffect } from 'react';
import { Pen, Eraser, Trash2, Download, X } from 'lucide-react';

const PEN_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'>" +
  "<path d='M4 24l5.2-1.4L24.4 7.4a2.8 2.8 0 0 0-3.9-3.9L5.4 18.8 4 24z' fill='#8ab4f8' stroke='#ffffff' stroke-width='1.4' stroke-linejoin='round'/>" +
  "<path d='M17.9 5.6l4.5 4.5' stroke='#202124' stroke-width='1.2'/>" +
  "<path d='M5.4 18.8l5.8 1.6' stroke='#202124' stroke-width='1' opacity='.55'/>" +
  '</svg>';

const ERASER_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'>" +
  "<circle cx='14' cy='14' r='11' fill='rgba(255,255,255,0.12)' stroke='#ffffff' stroke-width='1.6'/>" +
  "<circle cx='14' cy='14' r='1.4' fill='#ffffff'/>" +
  '</svg>';

const svgDataUrl = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
const PEN_IMAGE = svgDataUrl(PEN_SVG);
const ERASER_IMAGE = svgDataUrl(ERASER_SVG);

// Nib tip inside the 28x28 pen drawing (bottom-left) and eraser ring centre.
const PEN_TIP = { x: 4, y: 24 };
const ERASER_CENTER = { x: 14, y: 14 };

export default function Whiteboard({
  roomId = '',
  socket = null,
  initialStrokes = [],
  onClose = () => {},
}) {
  const canvasRef = useRef(null);
  const cursorRef = useRef(null);
  const [tool, setTool] = useState('pen'); // 'pen' | 'eraser'
  const [color, setColor] = useState('#8ab4f8');
  const [lineWidth, setLineWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);

  const activeStrokeRef = useRef(null);
  const remoteStrokesRef = useRef(new Map());
  const localStrokesRef = useRef([]);

  const colors = ['#ffffff', '#8ab4f8', '#ea4335', '#fbbc04', '#34a853', '#a142f4'];

  const applyStrokeStyle = (ctx, stroke) => {
    ctx.strokeStyle = stroke.tool === 'eraser' ? '#202124' : stroke.color;
    ctx.fillStyle = stroke.tool === 'eraser' ? '#202124' : stroke.color;
    ctx.lineWidth = stroke.tool === 'eraser' ? stroke.width * 4 : stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  // Remote/replayed stroke rendering with midpoint-quadratic smoothing.
  // Each segment is drawn from the previous midpoint, through the previous point,
  // to the new midpoint — matching the sender's local curve exactly.
  const drawStrokeOnCanvas = (ctx, stroke) => {
    const { fromX, fromY, toX, toY, strokeId } = stroke;
    applyStrokeStyle(ctx, stroke);

    if (Math.abs(toX - fromX) < 0.01 && Math.abs(toY - fromY) < 0.01) {
      ctx.beginPath();
      ctx.arc(toX, toY, Math.max(ctx.lineWidth / 2, 1), 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    const key = strokeId || 'legacy';
    let state = remoteStrokesRef.current.get(key);
    if (!state) state = { lastMid: { x: fromX, y: fromY } };

    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;
    ctx.beginPath();
    ctx.moveTo(state.lastMid.x, state.lastMid.y);
    ctx.quadraticCurveTo(fromX, fromY, midX, midY);
    ctx.stroke();

    state.lastMid = { x: midX, y: midY };
    remoteStrokesRef.current.set(key, state);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Keep the drawing buffer in sync with the rendered size (it changes when the
    // layout settles or the window resizes) and scale by DPR for crisp strokes.
    // All stroke coordinates are CSS pixels, so the pointer maps 1:1 to the ink.
    const applyCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.setTransform(w / rect.width, 0, 0, h / rect.height, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };

    const replay = () => {
      applyCanvasSize();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      remoteStrokesRef.current.clear();
      initialStrokes.forEach((stroke) => drawStrokeOnCanvas(ctx, stroke));
      localStrokesRef.current.forEach((stroke) => drawStrokeOnCanvas(ctx, stroke));
    };
    replay();

    const resizeObserver = new ResizeObserver(() => replay());
    if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);

    if (socket) {
      socket.on('whiteboard-draw', (stroke) => {
        drawStrokeOnCanvas(ctx, stroke);
      });

      socket.on('whiteboard-clear', () => {
        localStrokesRef.current = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        remoteStrokesRef.current.clear();
      });
    }

    return () => {
      resizeObserver.disconnect();
      if (socket) {
        socket.off('whiteboard-draw');
        socket.off('whiteboard-clear');
      }
    };
  }, [socket, initialStrokes]);

  const getPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDrawing = (e) => {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    moveCursor(e);
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {}

    const p = getPoint(e);
    const stroke = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      last: p,
      lastMid: p,
      color,
      width: lineWidth,
      tool,
    };
    activeStrokeRef.current = stroke;
    setIsDrawing(true);

    // Dot for a simple click/tap
    const ctx = canvas.getContext('2d');
    applyStrokeStyle(ctx, stroke);
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(ctx.lineWidth / 2, 1), 0, Math.PI * 2);
    ctx.fill();

    localStrokesRef.current.push({
      strokeId: stroke.id,
      fromX: p.x,
      fromY: p.y,
      toX: p.x,
      toY: p.y,
      color: stroke.color,
      width: stroke.width,
      tool: stroke.tool,
    });
  };

  const draw = (e) => {
    const stroke = activeStrokeRef.current;
    if (!stroke) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    applyStrokeStyle(ctx, stroke);

    const native = e.nativeEvent || e;
    const points =
      native.getCoalescedEvents && native.getCoalescedEvents().length > 0
        ? native.getCoalescedEvents()
        : [native];

    points.forEach((ev) => {
      const p = getPoint(ev);
      const dx = p.x - stroke.last.x;
      const dy = p.y - stroke.last.y;
      if (Math.hypot(dx, dy) < 0.7) return;

      const midX = (stroke.last.x + p.x) / 2;
      const midY = (stroke.last.y + p.y) / 2;

      ctx.beginPath();
      ctx.moveTo(stroke.lastMid.x, stroke.lastMid.y);
      ctx.quadraticCurveTo(stroke.last.x, stroke.last.y, midX, midY);
      ctx.stroke();

      const segment = {
        strokeId: stroke.id,
        fromX: stroke.last.x,
        fromY: stroke.last.y,
        toX: p.x,
        toY: p.y,
        color: stroke.color,
        width: stroke.width,
        tool: stroke.tool,
      };
      if (socket) socket.emit('whiteboard-draw', { roomId, stroke: segment });
      localStrokesRef.current.push(segment);

      stroke.last = p;
      stroke.lastMid = { x: midX, y: midY };
    });
  };

  const stopDrawing = () => {
    const stroke = activeStrokeRef.current;
    if (stroke) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        applyStrokeStyle(ctx, stroke);
        ctx.beginPath();
        ctx.moveTo(stroke.lastMid.x, stroke.lastMid.y);
        ctx.quadraticCurveTo(stroke.last.x, stroke.last.y, stroke.last.x, stroke.last.y);
        ctx.stroke();
      }
    }
    activeStrokeRef.current = null;
    setIsDrawing(false);
  };

  // The pen/eraser is drawn inside the board at the exact coordinates used for
  // painting, so the nib always sits on the ink. Relying on the OS cursor hotspot
  // caused the drawn pen to drift from the stroke on HiDPI/Windows setups.
  const moveCursor = (e) => {
    const el = cursorRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;
    if (e.pointerType === 'touch') {
      el.style.display = 'none';
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const offset = tool === 'eraser' ? ERASER_CENTER : PEN_TIP;
    el.style.transform = `translate3d(${e.clientX - rect.left - offset.x}px, ${e.clientY - rect.top - offset.y}px, 0)`;
    el.style.display = 'block';
  };

  const hideCursor = () => {
    if (cursorRef.current) cursorRef.current.style.display = 'none';
  };

  const handlePointerMove = (e) => {
    moveCursor(e);
    draw(e);
  };

  const handlePointerLeave = (e) => {
    hideCursor();
    stopDrawing(e);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    remoteStrokesRef.current.clear();
    localStrokesRef.current = [];
    if (socket) {
      socket.emit('whiteboard-clear', { roomId });
    }
  };

  const exportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `Milo-Board-${roomId}-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: '16px',
        backgroundColor: '#202124',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 35,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
      }}
      className="animate-fade-in"
    >
      {/* Whiteboard Toolbar */}
      <div
        style={{
          minHeight: '56px',
          backgroundColor: '#303134',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#e8eaed', marginRight: '12px' }}>
            🎨 Milo Board
          </span>

          {/* Tools */}
          <button
            onClick={() => setTool('pen')}
            title="Pen"
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              backgroundColor: tool === 'pen' ? '#8ab4f8' : 'transparent',
              color: tool === 'pen' ? '#202124' : '#e8eaed',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: '500',
            }}
          >
            <Pen size={16} /> Pen
          </button>

          <button
            onClick={() => setTool('eraser')}
            title="Eraser"
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              backgroundColor: tool === 'eraser' ? '#8ab4f8' : 'transparent',
              color: tool === 'eraser' ? '#202124' : '#e8eaed',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: '500',
            }}
          >
            <Eraser size={16} /> Eraser
          </button>

          {/* Color Palette */}
          {tool === 'pen' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '12px' }}>
              {colors.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: c,
                    border: color === c ? '2.5px solid #fff' : '1px solid rgba(0,0,0,0.4)',
                    boxShadow: color === c ? '0 0 6px rgba(255,255,255,0.6)' : 'none',
                    transform: color === c ? 'scale(1.15)' : 'scale(1)',
                    transition: 'all 0.15s',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={clearCanvas}
            title="Clear canvas"
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              color: '#ea4335',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
            }}
          >
            <Trash2 size={16} /> Clear
          </button>

          <button
            onClick={exportImage}
            title="Export as PNG image"
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              backgroundColor: '#1a73e8',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: '500',
            }}
          >
            <Download size={16} /> Save
          </button>

          <button
            onClick={onClose}
            title="Close whiteboard"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9aa0a6',
              marginLeft: '8px',
            }}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
        <canvas
          ref={canvasRef}
          data-tool={tool}
          onPointerDown={startDrawing}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrawing}
          onPointerCancel={handlePointerLeave}
          onPointerLeave={handlePointerLeave}
          style={{
            width: '100%',
            height: '100%',
            cursor: 'none',
            touchAction: 'none',
          }}
        />
        {/* In-board pen/eraser rendered at the exact ink coordinates */}
        <img
          ref={cursorRef}
          data-canvas-cursor={tool}
          src={tool === 'eraser' ? ERASER_IMAGE : PEN_IMAGE}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '28px',
            height: '28px',
            display: 'none',
            pointerEvents: 'none',
            zIndex: 5,
            transform: 'translate3d(-100px, -100px, 0)',
            willChange: 'transform',
            userSelect: 'none',
          }}
        />
      </div>
    </div>
  );
}
