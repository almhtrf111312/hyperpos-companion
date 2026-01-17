import { useEffect, useState } from 'react';

interface ClickInfo {
  timestamp: number;
  target: string;
  elementFromPoint: string;
  pointerEvents: string;
  zIndex: string;
  position: string;
  x: number;
  y: number;
}

export function ClickProbe() {
  const [lastClick, setLastClick] = useState<ClickInfo | null>(null);
  const [clickCount, setClickCount] = useState(0);

  useEffect(() => {
    const handleEvent = (e: PointerEvent | MouseEvent | TouchEvent) => {
      let x: number, y: number;
      
      if ('touches' in e && e.touches.length > 0) {
        x = e.touches[0].clientX;
        y = e.touches[0].clientY;
      } else if ('clientX' in e) {
        x = e.clientX;
        y = e.clientY;
      } else {
        return;
      }

      const target = e.target as HTMLElement;
      const topElement = document.elementFromPoint(x, y) as HTMLElement;
      
      const targetInfo = target ? `${target.tagName}.${target.className?.toString().slice(0, 50) || 'no-class'}` : 'null';
      const topInfo = topElement ? `${topElement.tagName}.${topElement.className?.toString().slice(0, 50) || 'no-class'}` : 'null';
      
      let pointerEvents = 'unknown';
      let zIndex = 'unknown';
      let position = 'unknown';
      
      if (topElement) {
        try {
          const style = getComputedStyle(topElement);
          pointerEvents = style.pointerEvents;
          zIndex = style.zIndex;
          position = style.position;
        } catch (err) {
          console.error('[ClickProbe] Failed to get computed style:', err);
        }
      }

      const info: ClickInfo = {
        timestamp: Date.now(),
        target: targetInfo,
        elementFromPoint: topInfo,
        pointerEvents,
        zIndex,
        position,
        x,
        y,
      };

      setLastClick(info);
      setClickCount(prev => prev + 1);

      console.log('[ClickProbe] Event detected:', {
        type: e.type,
        x,
        y,
        target: targetInfo,
        topElement: topInfo,
        pointerEvents,
        zIndex,
        position,
      });
    };

    // Attach in capture phase to catch events before anything else
    document.addEventListener('pointerdown', handleEvent, true);
    document.addEventListener('click', handleEvent, true);
    document.addEventListener('touchstart', handleEvent, true);

    console.log('[ClickProbe] Initialized - listening for clicks...');

    // Check body/root pointer-events
    try {
      const bodyStyle = getComputedStyle(document.body);
      const rootEl = document.getElementById('root');
      const rootStyle = rootEl ? getComputedStyle(rootEl) : null;
      
      console.log('[ClickProbe] Initial pointer-events check:', {
        body: bodyStyle.pointerEvents,
        root: rootStyle?.pointerEvents || 'no-root',
        html: getComputedStyle(document.documentElement).pointerEvents,
      });
    } catch (err) {
      console.error('[ClickProbe] Failed to check pointer-events:', err);
    }

    return () => {
      document.removeEventListener('pointerdown', handleEvent, true);
      document.removeEventListener('click', handleEvent, true);
      document.removeEventListener('touchstart', handleEvent, true);
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 999999,
        background: 'rgba(0, 0, 0, 0.9)',
        color: '#0f0',
        padding: '8px 12px',
        fontSize: '11px',
        fontFamily: 'monospace',
        direction: 'ltr',
        textAlign: 'left',
        pointerEvents: 'none',
      }}
    >
      <div>🔍 Click Probe Active | Clicks: {clickCount}</div>
      {lastClick ? (
        <div style={{ marginTop: '4px', color: '#ff0' }}>
          Last: [{lastClick.x}, {lastClick.y}] → {lastClick.elementFromPoint} | 
          pointer-events: {lastClick.pointerEvents} | z-index: {lastClick.zIndex}
        </div>
      ) : (
        <div style={{ marginTop: '4px', color: '#888' }}>انقر في أي مكان لرؤية العنصر...</div>
      )}
    </div>
  );
}
