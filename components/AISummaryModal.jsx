'use strict';
import React, { useState } from 'react';
import { Sparkles, Copy, Check, Download, X, Home } from 'lucide-react';

export default function AISummaryModal({
  summary = '',
  roomId = '',
  onClose = () => {},
  onBackHome = () => {},
}) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const downloadSummaryFile = () => {
    const element = document.createElement('a');
    const file = new Blob([summary], { type: 'text/markdown' });
    element.href = URL.createObjectURL(file);
    element.download = `Milo-Meeting-Summary-${roomId}-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      className="animate-fade-in"
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '85vh',
          backgroundColor: '#28292c',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, rgba(161, 66, 244, 0.15), rgba(26, 115, 232, 0.15))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'rgba(161, 66, 244, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#d7aefb',
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#e8eaed' }}>
                Milo AI Meeting Summary
              </h3>
              <p style={{ fontSize: '12px', color: '#9aa0a6' }}>Room: {roomId}</p>
            </div>
          </div>

          <button
            onClick={onClose}
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

        {/* Modal Body */}
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          <div
            style={{
              backgroundColor: '#202124',
              padding: '20px',
              borderRadius: '12px',
              fontSize: '14px',
              lineHeight: '1.6',
              color: '#e8eaed',
              whiteSpace: 'pre-wrap',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            {summary || 'No summary generated yet.'}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#202124',
          }}
        >
          <button
            onClick={onBackHome}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: '#3c4043',
              color: '#e8eaed',
              fontSize: '13px',
              fontWeight: '500',
            }}
          >
            <Home size={16} /> Home
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={copyToClipboard}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: '#3c4043',
                color: '#e8eaed',
                fontSize: '13px',
                fontWeight: '500',
              }}
            >
              {copied ? <Check size={16} color="#81c995" /> : <Copy size={16} />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            <button
              onClick={downloadSummaryFile}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 18px',
                borderRadius: '8px',
                backgroundColor: '#1a73e8',
                color: '#fff',
                fontSize: '13px',
                fontWeight: '600',
              }}
            >
              <Download size={16} /> Download (.md)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
