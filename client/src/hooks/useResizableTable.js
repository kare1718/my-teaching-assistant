import { useState, useCallback, useEffect, useRef } from 'react';

const STORAGE_PREFIX = 'resize-table-';

export default function useResizableTable(storageKey, columnCount) {
  const [widths, setWidths] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === columnCount) return parsed;
      }
    } catch {}
    return null; // null = use auto widths
  });

  const tableRef = useRef(null);
  const dragState = useRef(null);

  useEffect(() => {
    if (widths) {
      try {
        localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(widths));
      } catch {}
    }
  }, [widths, storageKey]);

  const handleColumnMouseDown = useCallback((colIndex, e) => {
    e.preventDefault();
    const table = tableRef.current;
    if (!table) return;

    // Capture current column widths if not yet set
    const ths = table.querySelectorAll('thead th');
    const currentWidths = Array.from(ths).map(th => th.getBoundingClientRect().width);

    const startX = e.clientX;
    const startWidths = widths || currentWidths;

    dragState.current = { colIndex, startX, startWidths: [...startWidths] };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev) => {
      const { colIndex: idx, startX: sx, startWidths: sw } = dragState.current;
      const dx = ev.clientX - sx;
      const newWidths = [...sw];
      newWidths[idx] = Math.max(40, sw[idx] + dx);
      setWidths(newWidths);
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
  }, [widths]);

  const resetWidths = useCallback(() => {
    setWidths(null);
    try {
      localStorage.removeItem(STORAGE_PREFIX + storageKey);
    } catch {}
  }, [storageKey]);

  const getThStyle = useCallback((colIndex) => {
    if (!widths) return { position: 'relative' };
    return {
      position: 'relative',
      width: widths[colIndex],
      minWidth: 40,
    };
  }, [widths]);

  return { tableRef, handleColumnMouseDown, resetWidths, getThStyle, widths };
}
