import { useState } from 'react';

export default function ResizeHandle({ onMouseDown, vertical = true }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        top: 0,
        right: -4,
        width: 8,
        height: '100%',
        cursor: 'col-resize',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{
        width: 3,
        height: hovered ? '60%' : '30%',
        minHeight: 16,
        maxHeight: 60,
        borderRadius: 2,
        background: hovered ? 'var(--primary)' : 'var(--border)',
        transition: 'background 0.15s, height 0.15s',
        opacity: hovered ? 1 : 0.5,
      }} />
    </div>
  );
}

export function GridResizeHandle({ onMouseDown, className = '' }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`resize-handle ${className}`}
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        width: 8,
        cursor: 'col-resize',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        alignSelf: 'stretch',
        margin: '0 -4px',
        zIndex: 10,
      }}
    >
      <div style={{
        width: 3,
        height: hovered ? '50%' : '24px',
        minHeight: 20,
        maxHeight: 80,
        borderRadius: 2,
        background: hovered ? 'var(--primary)' : 'var(--border)',
        transition: 'background 0.15s, height 0.15s',
        opacity: hovered ? 1 : 0.4,
      }} />
    </div>
  );
}
