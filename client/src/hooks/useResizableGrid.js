import { useState, useCallback, useEffect, useRef } from 'react';

const STORAGE_PREFIX = 'resize-';

export default function useResizableGrid(storageKey, defaultSizes) {
  const [sizes, setSizes] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === defaultSizes.length) return parsed;
      }
    } catch {}
    return [...defaultSizes];
  });

  const containerRef = useRef(null);
  const dragState = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(sizes));
    } catch {}
  }, [sizes, storageKey]);

  const handleMouseDown = useCallback((index, e) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const totalWidth = rect.width;
    const startX = e.clientX;
    const startSizes = [...sizes];
    const totalFr = startSizes.reduce((a, b) => a + b, 0);

    dragState.current = { index, startX, startSizes, totalWidth, totalFr };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev) => {
      const { index: idx, startX: sx, startSizes: ss, totalWidth: tw, totalFr: tf } = dragState.current;
      const dx = ev.clientX - sx;
      const frPerPx = tf / tw;
      const deltaFr = dx * frPerPx;

      const newSizes = [...ss];
      const minFr = 0.15 * tf / newSizes.length;

      newSizes[idx] = Math.max(minFr, ss[idx] + deltaFr);
      newSizes[idx + 1] = Math.max(minFr, ss[idx + 1] - deltaFr);

      setSizes(newSizes);
    };

    const onMouseUp = () => {
      dragState.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [sizes]);

  const resetSizes = useCallback(() => {
    setSizes([...defaultSizes]);
  }, [defaultSizes]);

  const gridTemplateColumns = sizes.map(s => `${s.toFixed(3)}fr`).join(' ');

  return { sizes, containerRef, handleMouseDown, resetSizes, gridTemplateColumns };
}
