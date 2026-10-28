'use strict';
import React, { useRef, useState, useEffect } from 'react';
import { Pen, Eraser, Trash2, Download, X } from 'lucide-react';

export default function Whiteboard({
  roomId = '',
  socket = null,
  initialStrokes = [],
  onClose = () => {},
}) {
  const canvasRef = useRef(null);
  const [tool, setTool] = useState('pen'); // 'pen' | 'eraser'
  const [color, setColor] = useState('#8ab4f8');
  const [lineWidth, setLineWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);

  const colors = ['#ffffff', '#8ab4f8', '#ea4335', '#fbbc04', '#34a853', '#a142f4'];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas dimensions to parent container
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw initial strokes if any
    initialStrokes.forEach((stroke) => drawStrokeOnCanvas(ctx, stroke));

    // Listen for remote strokes from other participants
    if (socket) {
      socket.on('whiteboard-draw', (stroke) => {
        drawStrokeOnCanvas(ctx, stroke);
      });

      socket.on('whiteboard-clear', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      });
    }

    return () => {
      if (socket) {
        socket.off('whiteboard-draw');
        socket.off('whiteboard-clear');
      }
    };
  }, [socket, initialStrokes]);

  const drawStrokeOnCanvas = (ctx, stroke) => {
    const { fromX, fromY, toX, toY, color: sColor, width: sWidth, tool: sTool } = stroke;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.strokeStyle = sTool === 'eraser' ? '#202124' : sColor;
    ctx.lineWidth = sTool === 'eraser' ? sWidth * 4 : sWidth;
    ctx.stroke();
  };

  const lastPos = useRef({ x: 0, y: 0 });

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    lastPos.current = { x, y };
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || e.touches?.[0]?.clientX;
    const clientY = e.clientY || e.touches?.[0]?.clientY;
    if (!clientX || !clientY) return;

    const toX = clientX - rect.left;
    const toY = clientY - rect.top;

    const stroke = {
      fromX: lastPos.current.x,
      fromY: lastPos.current.y,
      toX,
      toY,
      color,
      width: lineWidth,
      tool,
    };

    const ctx = canvas.getContext('2d');
    drawStrokeOnCanvas(ctx, stroke);

    // Broadcast stroke to room members
    if (socket) {
      socket.emit('whiteboard-draw', { roomId, stroke });
    }

    lastPos.current = { x: toX, y: toY };
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
          height: '56px',
          backgroundColor: '#303134',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#e8eaed', marginRight: '12px' }}>
            🎨 Milo Board
          </span>

          {/* Tools */}
          <button
            onClick={() => setTool('pen')}
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
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{ width: '100%', height: '100%', cursor: tool === 'eraser' ? 'cell' : 'crosshair', touchAction: 'none' }}
        />
      </div>
    </div>
  );
}
